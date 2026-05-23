# Deploy to gideonabochie.org

## Option A: Cloudflare Pages (Recommended — Free)

1. Go to https://dash.cloudflare.com → Pages
2. Click "Create a project" → "Direct Upload"
3. Upload `index.html` (or drag & drop)
4. Set the project name (e.g. `gideonabochie`)
5. In your domain DNS settings, add a CNAME record:
   - `gideonabochie.org` → `gideonabochie.pages.dev`
6. It goes live in ~60 seconds

## Option B: Netlify (Free)

1. Go to https://app.netlify.com → Sites → Drag & drop `index.html`
2. Settings → Domain management → Add custom domain
3. Enter `gideonabochie.org` and follow DNS instructions

## Option C: GitHub Pages (Free)

1. Create a repo named `gideonabochie.org`
2. Push `index.html` to the repo
3. Enable Pages at Settings → Pages → Deploy from main branch
4. Set custom domain to `gideonabochie.org`

---

## Customization Checklist

- [ ] **Ko-fi URL** — Update `ko-fi.com/gideonabochie` to your actual username (line 373)
- [ ] **Hero photo** — Replace the placeholder div (#heroMedia) with `<img src="your-photo.jpg">`
- [ ] **Story photo** — Replace the placeholder div (#storyMedia) with your photo
- [ ] **Gallery** — Replace the 6 gallery placeholder items with your actual images
- [ ] **Testimonials** — Replace sample quotes with real testimonial text
- [ ] **Stats** — Update the numbers in `data-target` attributes to your real metrics
- [ ] **Story text** — Customize the about section with your real testimony
- [ ] **Phone/email** — Verify contact details are correct
- [ ] **OG image** — Replace `og-image.jpg` URL in meta tags with your actual image URL
