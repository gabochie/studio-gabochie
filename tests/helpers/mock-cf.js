/**
 * Build a mock D1 binding that returns canned data.
 * Handles ? placeholders and literal values in WHERE clauses.
 */
export function mockDb(tables) {
  tables = tables || {};
  var db = {
    _tables: Object.assign({}, tables),

    prepare(sql) {
      db._lastSql = sql;
      var chain = {
        _bound: [],
        bind() {
          chain._bound = Array.prototype.slice.call(arguments);
          return chain;
        },
        async first() {
          var table = db._inferTable();
          var rows = db._tables[table] || [];
          var matched = rows;
          if (chain._bound.length > 0 || db._hasWhere()) {
            var conditions = db._parseWhere(chain._bound);
            matched = rows.filter(function (r) {
              return db._matchRow(r, conditions, function (cond) {
                if (cond.val !== '?') return cond.val;
                var idx = cond.bindIndex !== undefined ? cond.bindIndex : 0;
                return chain._bound[idx];
              });
            });
          }
          // Handle aggregate queries
          var aggResult = db._computeAggregates(matched, sql);
          if (aggResult) return aggResult;
          // Handle COALESCE(MAX(...))+1 AS next FROM
          var asMatch = db._lastSql.match(/AS\s+(\w+)\s+FROM/i);
          if (asMatch && asMatch[1] === 'next') {
            var maxNum = 0;
            matched.forEach(function (r) {
              var m = String(r[db._parseCol()] || '').match(/(\d+)$/);
              if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
            });
            var result = {};
            result[asMatch[1]] = maxNum + 1;
            return result;
          }
          return matched[0] || null;
        },
        async all() {
          var table = db._inferTable();
          var rows = db._tables[table] || [];
          var matched = rows;
          if (db._hasWhere()) {
            var conditions = db._parseWhere(chain._bound);
            matched = rows.filter(function (r) {
              return db._matchRow(r, conditions, function (cond) {
                if (cond.val !== '?') return cond.val;
                var idx = cond.bindIndex !== undefined ? cond.bindIndex : 0;
                return chain._bound[idx];
              });
            });
          }
          // Handle GROUP BY
          var gbMatch = db._lastSql && db._lastSql.match(/GROUP\s+BY\s+(\w+(?:\.\w+)?)/i);
          if (gbMatch) {
            var gbCol = gbMatch[1].replace(/^\w+\./, ''); // strip table prefix: w.id -> id
            var groups = {};
            matched.forEach(function (r) {
              var key = r[gbCol];
              if (key === undefined) key = 'undefined';
              if (!groups[key]) groups[key] = { _rows: [] };
              groups[key]._rows.push(r);
            });
            var results = Object.keys(groups).map(function (k) {
              var firstRow = groups[k]._rows[0];
              var row = Object.assign({}, firstRow);
              row.count = groups[k]._rows.length;
              return row;
            });
            return { results: results };
          }
          return { results: matched.slice() };
        },
        async run() {
          var sql = db._lastSql;
          // Track auto-increment IDs per table
          if (!db._autoId) db._autoId = {};
          // INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
          // Values are split paren-aware so datetime('now') and nested calls survive.
          // NOTE: INSERT OR IGNORE is intentionally not executed (no constraint
          // tracking); production relies on real D1 OR IGNORE semantics.
          var insertRe = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(/i;
          var im = sql.match(insertRe);
          if (im) {
            var tbl = im[1];
            if (!db._tables[tbl]) db._tables[tbl] = [];
            var cols = im[2].split(',').map(function(c) { return c.trim(); });
            // Extract the VALUES list up to its matching close paren (ignores
            // any trailing ON CONFLICT / RETURNING clause).
            var vStart = im[0].length;
            var vSql = sql.slice(sql.indexOf(im[0]) + vStart);
            var vDepth = 0, vEnd = vSql.length;
            var vStr = false, vStrCh = '';
            for (var ski = 0; ski < vSql.length; ski++) {
              var sch = vSql[ski];
              if (vStr) { if (sch === vStrCh) vStr = false; continue; }
              if (sch === "'" || sch === '"') { vStr = true; vStrCh = sch; continue; }
              if (sch === '(') vDepth++;
              else if (sch === ')') { vDepth--; if (vDepth < 0) { vEnd = ski; break; } }
            }
            im[3] = vSql.slice(0, vEnd);
            var row = {};
            var valParts = [];
            var depth = 0, cur = '', inStr = false, strCh = '';
            for (var vi = 0; vi < im[3].length; vi++) {
              var ch = im[3][vi];
              if (inStr) {
                cur += ch;
                if (ch === strCh) inStr = false;
              } else if (ch === "'" || ch === '"') {
                inStr = true; strCh = ch; cur += ch;
              } else if (ch === '(') {
                depth++; cur += ch;
              } else if (ch === ')') {
                depth--; cur += ch;
              } else if (ch === ',' && depth === 0) {
                valParts.push(cur.trim()); cur = '';
              } else {
                cur += ch;
              }
            }
            if (cur.trim() !== '' || valParts.length) valParts.push(cur.trim());
            var bi = 0;
            for (var ci = 0; ci < cols.length; ci++) {
              if (valParts[ci] === '?') {
                row[cols[ci]] = chain._bound[bi] !== undefined ? chain._bound[bi] : '';
                bi++;
              } else if (valParts[ci] !== undefined) {
                var vp = valParts[ci].replace(/^['"]|['"]$/g, '');
                row[cols[ci]] = /^-?\d+(?:\.\d+)?$/.test(vp) ? Number(vp) : vp;
              } else {
                row[cols[ci]] = '';
              }
            }
            if (!db._autoId[tbl]) db._autoId[tbl] = db._tables[tbl].length;
            db._autoId[tbl]++;
            row.id = db._autoId[tbl];
            // D1 tables default created_at to datetime('now'); mirror that so
            // time-based filters (rate limiting, expiry) behave realistically.
            if (row.created_at === undefined) row.created_at = db._nowWithModifier(null);
            db._tables[tbl].push(row);
            return { success: true, meta: { changes: 1, last_row_id: row.id } };
          }
          // UPDATE table SET col = ?, col2 = ? WHERE col = ?
          var updateRe = /UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i;
          var um = sql.match(updateRe) || sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+)$/i);
          if (um) {
            var utbl = um[1];
            var setPart = um[2];
            var wherePart = um[3] || '';
            var assignments = [];
            var setRe = /((?:[\w.]+)\s*=\s*(?:\?|'[^']*'|-?\d+(?:\.\d+)?|json_set\([^)]*\)))/g;
            var sm;
            while ((sm = setRe.exec(setPart)) !== null) {
              var assign = sm[1].split('=');
              var col = assign[0].trim().replace(/^\w+\./, '');
              var val = assign.slice(1).join('=').trim();
              if (val === '?') {
                assignments.push({ col: col, val: '?bound?' });
              } else if (/^json_set/i.test(val)) {
                // Represent the metadata value as a stable marker.
                assignments.push({ col: col, val: '{"gateway":"g","gateway_txid":"t"}' });
              } else if (/^-?\d+(?:\.\d+)?$/.test(val)) {
                assignments.push({ col: col, val: Number(val) });
              } else {
                assignments.push({ col: col, val: val.replace(/^['"]|['"]$/g, '') });
              }
            }
            var conditions = wherePart ? db._parseWhere([]) : [];
            // Resolve SET binds first (in order), then WHERE binds from the tail.
            var bound = chain._bound;
            var setCount = assignments.filter(function(a) { return a.val === '?bound?'; }).length;
            var whereStart = bound.length - conditions.length;
            var setIdx = 0;
            var changed = 0;
            (db._tables[utbl] || []).forEach(function (r) {
              var match = db._matchRow(r, conditions, function (cond) {
                if (cond.val !== '?') return cond.val;
                var ci = conditions.indexOf(cond);
                return bound[whereStart + ci];
              });
              if (match) {
                assignments.forEach(function (a) {
                  r[a.col] = a.val === '?bound?' ? bound[setIdx++] : a.val;
                });
                changed++;
              }
            });
            return { success: true, meta: { changes: changed } };
          }
          // DELETE FROM table WHERE col = ?
          var delRe = /DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i;
          var dm = sql.match(delRe);
          if (dm) {
            var dtbl = dm[1];
            var dwhere = dm[2] || '';
            var dconds = dwhere ? db._parseWhere(chain._bound) : [];
            var before = (db._tables[dtbl] || []).length;
            var dStart = chain._bound.length - dconds.length;
            db._tables[dtbl] = (db._tables[dtbl] || []).filter(function (r) {
              return !dconds.every(function (cond, ci) {
                var val = cond.val === '?' ? chain._bound[dStart + ci] : cond.val;
                if (val === undefined) return false;
                return String(r[cond.col]) === String(val);
              });
            });
            return { success: true, meta: { changes: before - db._tables[dtbl].length } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
      return chain;
    },

    _inferTable() {
      var m = db._lastSql && db._lastSql.match(/FROM\s+(\w+)/i);
      return m ? m[1] : null;
    },

    _parseCol() {
      var m = db._lastSql && db._lastSql.match(/SUBSTR\((\w+)/i);
      return m ? m[1] : null;
    },

    _hasWhere() {
      return db._lastSql && /WHERE/i.test(db._lastSql);
    },

    _stripTable(col) {
      // Remove table alias prefix: co.category -> category
      var dot = col.indexOf('.');
      return dot >= 0 ? col.slice(dot + 1) : col;
    },

    _parseWhere(bound) {
      var wherePart = db._lastSql.split(/WHERE/i)[1];
      if (!wherePart) return [];
      // Strip the trailing ORDER BY / LIMIT clauses — they carry no filters.
      wherePart = wherePart.replace(/\s+ORDER\s+BY\s+.+$/i, '');
      wherePart = wherePart.replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?$/i, '');

      var conditions = [];
      var bindSeq = 0;
      var groupSeq = 0;

      db._splitTopLevel(wherePart, 'AND').forEach(function (part) {
        var body = part.trim();
        // Unwrap a parenthesised group: "(a LIKE ? OR b LIKE ?)"
        if (body.charAt(0) === '(' && body.charAt(body.length - 1) === ')') {
          body = body.slice(1, -1).trim();
        }
        var members = db._splitTopLevel(body, 'OR');
        // More than one member means the group is an OR — members may match
        // individually, the group as a whole must match at least one.
        var groupId = members.length > 1 ? groupSeq++ : null;
        members.forEach(function (member) {
          var cond = db._parseCondition(member, function () { return bindSeq++; });
          if (!cond) return;
          if (groupId !== null) cond.group = groupId;
          conditions.push(cond);
        });
      });

      return conditions;
    },

    /**
     * Parse one WHERE fragment into a condition.
     * `nextBind()` hands back the positional index of the next `?` so that
     * placeholder values resolve in SQL order.
     */
    _parseCondition(op, nextBind) {
      op = op.trim();
      if (!op) return null;
      // Column-to-column comparison (e.g. "1=1") — not evaluable, drop it.
      if (/^(?:\w+\.)?\w+\s*=\s*(?:\w+\.)?\w+$/.test(op)) return null;

      var nn = op.match(/^((?:\w+\.)?\w+)\s+IS\s+NOT\s+NULL$/i);
      if (nn) return { col: db._stripTable(nn[1]), op: 'IS NOT NULL' };

      var inM = op.match(/^((?:\w+\.)?\w+)\s+(NOT\s+IN|IN)\s*\((.+)\)$/i);
      if (inM) {
        var vals = db._subqueryValues(inM[3]);
        if (!vals) vals = inM[3].split(',').map(function (v) { return v.trim().replace(/^['"]|['"]$/g, ''); });
        return { col: db._stripTable(inM[1]), op: inM[2].replace(/\s+/g, ' ').toUpperCase(), vals: vals };
      }

      var m = op.match(/^((?:\w+\.)?\w+)\s*(=|!=|>=|<=|>|<|LIKE)\s*(.+)$/i);
      if (!m) return null;
      var col = db._stripTable(m[1]);
      var operator = m[2].toUpperCase();
      var raw = m[3].trim();

      if (raw === '?') {
        return { col: col, val: '?', op: operator, isLike: operator === 'LIKE', bindIndex: nextBind() };
      }

      // datetime('now') / datetime('now', '-7 days') resolve against the
      // current time so time-based filters behave like they do in D1.
      var dt = raw.match(/^datetime\s*\(\s*['"]now['"]\s*(?:,\s*(.+?))?\s*\)$/i);
      if (dt) {
        var dateCond = { col: col, op: operator, isDate: true };
        var modifier = dt[1] ? dt[1].trim() : '';
        if (modifier === '?') {
          dateCond.bindIndex = nextBind();
        } else if (modifier) {
          dateCond.dateModifier = modifier.replace(/^['"]|['"]$/g, '');
        }
        return dateCond;
      }

      raw = raw.replace(/^['"]|['"]$/g, '');
      if (operator === 'LIKE') return { col: col, val: raw, op: operator, isLike: true };
      return { col: col, val: raw, op: operator };
    },

    /**
     * Split on a keyword that is not nested inside parentheses.
     */
    _splitTopLevel(text, word) {
      var parts = [];
      var depth = 0;
      var buf = '';
      var i = 0;
      while (i < text.length) {
        var ch = text.charAt(i);
        if (ch === '(') { depth++; buf += ch; i++; continue; }
        if (ch === ')') { depth--; buf += ch; i++; continue; }
        if (depth === 0 && db._isWordAt(text, i, word) && text.substr(i, word.length).toUpperCase() === word.toUpperCase()) {
          parts.push(buf);
          buf = '';
          i += word.length;
          continue;
        }
        buf += ch;
        i++;
      }
      parts.push(buf);
      return parts.map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
    },

    _isWordAt(text, index, word) {
      var before = index > 0 ? text.charAt(index - 1) : ' ';
      var after = index + word.length < text.length ? text.charAt(index + word.length) : ' ';
      if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) return false;
      return true;
    },

    _subqueryValues(inner) {
      var sq = String(inner).trim().match(/^SELECT\s+(\w+)\s+FROM\s+(\w+)/i);
      if (!sq) return null;
      return (db._tables[sq[2]] || []).map(function (r) { return String(r[sq[1]]); });
    },

    /**
     * Evaluate a row against parsed conditions.
     * Conditions are ANDed; conditions sharing a `group` id are ORed.
     */
    /**
     * Compare two values the way SQLite would: numerically when both are
     * numbers, lexicographically otherwise (so ISO timestamps order correctly).
     */
    _compareValues(a, b) {
      var sa = String(a == null ? '' : a);
      var sb = String(b == null ? '' : b);
      if (/^-?\d+(\.\d+)?$/.test(sa) && /^-?\d+(\.\d+)?$/.test(sb)) {
        return parseFloat(sa) - parseFloat(sb);
      }
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    },

    /**
     * Current UTC time in SQLite's datetime format, optionally shifted by a
     * modifier such as '-60 seconds' or '+30 days'.
     */
    _nowWithModifier(modifier) {
      var d = new Date();
      var m = String(modifier == null ? '' : modifier).trim().replace(/^['"]|['"]$/g, '');
      var match = m.match(/^([+-])\s*(\d+)\s+(second|minute|hour|day|month|year)s?$/i);
      if (match) {
        var amount = parseInt(match[2], 10) * (match[1] === '-' ? -1 : 1);
        var unit = match[3].toLowerCase();
        if (unit === 'second') d = new Date(d.getTime() + amount * 1000);
        else if (unit === 'minute') d = new Date(d.getTime() + amount * 60000);
        else if (unit === 'hour') d = new Date(d.getTime() + amount * 3600000);
        else if (unit === 'day') d = new Date(d.getTime() + amount * 86400000);
        else if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + amount);
        else if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + amount);
      }
      return d.toISOString().slice(0, 19).replace('T', ' ');
    },

    _matchRow(row, conditions, resolveValue) {
      var plain = [];
      var groups = {};
      conditions.forEach(function (cond) {
        if (cond.group !== undefined && cond.group !== null) {
          if (!groups[cond.group]) groups[cond.group] = [];
          groups[cond.group].push(cond);
        } else {
          plain.push(cond);
        }
      });

      function evalCond(cond) {
        if (cond.op === 'IS NOT NULL') return row[cond.col] != null && row[cond.col] !== '';
        if (cond.op === 'IN') return cond.vals.indexOf(String(row[cond.col])) >= 0;
        if (cond.op === 'NOT IN') return cond.vals.indexOf(String(row[cond.col])) < 0;
        var val;
        if (cond.isDate) {
          var modifier = cond.dateModifier || '';
          if (cond.bindIndex !== undefined) {
            modifier = resolveValue({ val: '?', bindIndex: cond.bindIndex });
          }
          val = db._nowWithModifier(modifier);
        } else {
          val = resolveValue(cond);
        }
        if (val === undefined) return false;
        if (cond.isLike) {
          // SQLite LIKE is case-insensitive for ASCII — match the same way.
          var needle = String(val).replace(/%/g, '').toLowerCase();
          if (!needle) return true;
          return String(row[cond.col] == null ? '' : row[cond.col]).toLowerCase().indexOf(needle) >= 0;
        }
        if (cond.op === '!=') return String(row[cond.col]) !== String(val);
        if (cond.op === '=') return String(row[cond.col]) === String(val);
        var cmp = db._compareValues(row[cond.col], val);
        if (cond.op === '>') return cmp > 0;
        if (cond.op === '>=') return cmp >= 0;
        if (cond.op === '<') return cmp < 0;
        if (cond.op === '<=') return cmp <= 0;
        return false;
      }

      for (var i = 0; i < plain.length; i++) {
        if (!evalCond(plain[i])) return false;
      }
      for (var key in groups) {
        if (!Object.prototype.hasOwnProperty.call(groups, key)) continue;
        var members = groups[key];
        var matched = false;
        for (var m = 0; m < members.length; m++) {
          if (evalCond(members[m])) { matched = true; break; }
        }
        if (!matched) return false;
      }
      return true;
    },

    _computeAggregates(rows, sql) {
      var result = {};
      var found = false;
      // COUNT(*) AS alias
      var countStarRe = /COUNT\(\*\)\s+AS\s+(\w+)/gi;
      var m;
      while ((m = countStarRe.exec(sql)) !== null) {
        result[m[1]] = rows.length;
        found = true;
      }
      // COUNT(col) AS alias
      var countColRe = /COUNT\(\s*(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = countColRe.exec(sql)) !== null) {
        var cnt = rows.filter(function(r) { return r[m[1]] != null; }).length;
        if (result[m[2]] === undefined) { result[m[2]] = cnt; found = true; }
      }
      // COUNT(DISTINCT col) AS alias
      var cdRe = /COUNT\(\s*DISTINCT\s+(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = cdRe.exec(sql)) !== null) {
        var s = new Set(rows.map(function(r) { return r[m[1]]; }).filter(function(v) { return v != null && v !== ''; }));
        result[m[2]] = s.size;
        found = true;
      }
      // COALESCE(SUM(CASE WHEN col = 'val' THEN field ELSE N END), default) AS alias
      // Handle simple CASE WHEN equality inside SUM
      var caseRe = /COALESCE\(\s*SUM\(\s*CASE\s+WHEN\s+(\w+)\s*=\s*'([^']+)'\s+THEN\s+(\w+)\s+ELSE\s+(\d+(?:\.\d+)?)\s+END\s*\)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = caseRe.exec(sql)) !== null) {
        var sum = rows.reduce(function(acc, r) {
          var cond = String(r[m[1]]) === m[2];
          return acc + (cond ? (parseFloat(r[m[3]]) || 0) : parseFloat(m[4]));
        }, 0);
        result[m[6]] = isNaN(sum) ? parseFloat(m[5]) : sum;
        found = true;
      }
      // COALESCE(SUM(col), default) AS alias
      var csRe = /COALESCE\(\s*SUM\(\s*(\w+)\s*\)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = csRe.exec(sql)) !== null) {
        var total = rows.reduce(function(acc, r) { return acc + (parseFloat(r[m[1]]) || 0); }, 0);
        result[m[3]] = isNaN(total) ? parseFloat(m[2]) : total;
        found = true;
      }
      // SUM(col) AS alias (without COALESCE)
      var sumRe2 = /SUM\(\s*(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = sumRe2.exec(sql)) !== null) {
        if (result[m[2]] === undefined) {
          var sumTotal = rows.reduce(function(acc, r) { return acc + (parseFloat(r[m[1]]) || 0); }, 0);
          result[m[2]] = sumTotal;
          found = true;
        }
      }
      return found ? result : null;
    },
  };
  return db;
}

/**
 * Build a mock ASSETS binding.
 */
export function mockAssets(response) {
  return {
    async fetch() {
      if (response) return response;
      return new Response('mock file content', {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    },
  };
}

/**
 * Build a full context object for onRequest handlers.
 */
export function buildContext(url, overrides) {
  overrides = overrides || {};
  var request = new Request(url || 'http://localhost/');
  return Object.assign({
    request: request,
    env: Object.assign({
      DB: mockDb(),
      ASSETS: mockAssets(),
    }, overrides.env || {}),
  }, overrides);
}
