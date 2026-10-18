INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, status, created_at) 
SELECT email, name, 'Discover Studio Gabochie', 
  '<p>Hello ' || name || ',</p><p>Welcome to Studio Gabochie — a Bible-based school of creativity, wisdom, and love.</p><p>We''d love to invite you to explore our free resources, courses, and community.</p><p>Visit <a href="https://studio.gabochie.com">studio.gabochie.com</a> to get started.</p><p>Blessings,<br>The Studio Gabochie Team</p>',
  'cold_newsletter', datetime('now'), 'pending', datetime('now')
FROM cold_outreach WHERE status = 'pending';