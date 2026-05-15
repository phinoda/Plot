# Chrome Web Store Release TODO

## 1. Prepare The Extension Build

- [x] Add extension icons to the repo.
  - [x] `icons/icon-16.png`
  - [x] `icons/icon-32.png`
  - [x] `icons/icon-48.png`
  - [x] `icons/icon-128.png`

- [x] Update `manifest.config.ts`.
  - [x] Add the `icons` field.
  - [x] Confirm the extension name: `Plot`.
  - [x] Confirm the version number.
  - [x] Polish the description.

Suggested description:

```text
A new tab workspace for tracking projects, decisions, learnings, and delivery.
```

- [x] Add a release build script.
  - [x] Create a clean production build.
  - [x] Avoid shipping stale files from older local builds.
  - [x] Produce a Chrome Web Store upload zip.

Release command:

```bash
npm run build:release
```

Upload file:

```text
release/plot-chrome-extension.zip
```

- [x] Run local checks.

```bash
npm run type-check
npm run build
```

- [ ] Load the built extension locally.
  - [ ] Open `chrome://extensions`.
  - [ ] Enable Developer mode.
  - [ ] Click `Load unpacked`.
  - [ ] Select the `dist` folder.

- [ ] Smoke test the extension.
  - [ ] New tab opens Plot.
  - [ ] Projects can be created.
  - [ ] Entries can be added.
  - [ ] Entries can be moved between Backlog, To-do, Decision, Learning, and Delivered.
  - [ ] Stats update after data entry.
  - [ ] Radar chart tooltips are in English.
  - [ ] No UI text appears in Chinese.
  - [ ] Refreshing the extension does not lose data.
  - [ ] Backup/export works.
  - [ ] Import/restore works.

## 2. Prepare Store Assets

- [ ] Create at least one Chrome Web Store screenshot.
  - [ ] Preferred size: `1280x800`.
  - [ ] Acceptable size: `640x400`.
  - [ ] Show the actual Plot new tab experience.

- [ ] Create 3-5 recommended screenshots.
  - [ ] Main project workspace.
  - [ ] Data entry workflow.
  - [ ] Stats view.
  - [ ] Radar chart / activity view.
  - [ ] Backup settings, if useful.

- [ ] Create a small promotional image.
  - [ ] Size: `440x280`.
  - [ ] Keep it simple and legible at small size.

- [ ] Prepare listing copy.

Short description:

```text
Turn your new tab into a private workspace for projects, decisions, learnings, and delivery.
```

Detailed description draft:

```text
Plot replaces your new tab page with a focused project workspace.

Track tasks from Backlog to To-do to Delivered, capture Decisions and Learnings as you work, and review your progress through lightweight stats and activity views.

Plot is designed for people who want a daily operating system for their projects without turning their workflow into a heavy task manager.
```

- [ ] Choose category.
  - [ ] Recommended: `Productivity`.

- [ ] Prepare support contact.
  - [ ] Support email.
  - [ ] Optional support website.

## 3. Prepare Privacy Information

- [x] Write a privacy policy page.

- [x] Publish the privacy policy URL.
  - [x] Deploy marketing site to Vercel project: `plot`
  - [x] Current Vercel production URL: `https://plot.nostock.studio`
  - [x] Add DNS record at current DNS provider:

```text
Type: A
Name: plot
Value: 76.76.21.21
TTL: default / automatic
```

  - [x] Re-run Vercel alias after DNS resolves:

```bash
cd website
vercel alias set plot-inky.vercel.app plot.nostock.studio
```

  - [x] Confirm final privacy URL:

```text
https://plot.nostock.studio/privacy.html
```

Privacy policy draft:

```text
Plot stores your project data, entries, layout, and preferences locally in your browser using Chrome storage.

Plot does not sell your data.
Plot does not use your data for advertising.
Plot does not transmit your project data to a remote server.

If future versions add optional sync, AI, or cloud features, this policy will be updated before those features are released.
```

- [ ] Fill out the Chrome Web Store privacy fields.

Single purpose:

```text
Plot replaces the new tab page with a private project workspace for tracking tasks, decisions, learnings, and delivery progress.
```

Permission justification for `storage`:

```text
Used to save the user's projects, entries, layout, and local workspace preferences in the browser.
```

Remote code:

```text
No, Plot does not execute remote code.
```

Data collection:

```text
Plot does not collect user data. Project data is stored locally in the user's browser.
```

## 4. Create The Chrome Web Store Item

- [ ] Register or sign in to the Chrome Web Store Developer Dashboard.
  - [ ] https://chrome.google.com/webstore/devconsole

- [ ] Create a new item.

- [ ] Upload the release zip.

- [ ] Complete the store listing.
  - [ ] Name.
  - [ ] Short description.
  - [ ] Detailed description.
  - [ ] Category.
  - [ ] Language.
  - [ ] Screenshots.
  - [ ] Promotional image.
  - [ ] Support contact.

- [ ] Complete privacy practices.
  - [ ] Single purpose.
  - [ ] Permission justification.
  - [ ] Data usage disclosure.
  - [ ] Remote code declaration.
  - [ ] Privacy policy URL.

- [ ] Choose distribution.
  - [ ] `Trusted testers` for first review pass, or
  - [ ] `Unlisted` for soft launch, or
  - [ ] `Public` for full launch.

- [ ] Submit for review.

## 5. After Submission

- [ ] Watch for review emails from Chrome Web Store.

- [ ] If rejected, record the reason here.

```text
Rejection reason:

Fix:

Resubmission date:
```

- [ ] After approval, test the live store version.
  - [ ] Install from Chrome Web Store.
  - [ ] Open a new tab.
  - [ ] Confirm data entry works.
  - [ ] Confirm local storage persists.
  - [ ] Confirm screenshots and listing copy look correct.

## 6. Future Release Checklist

- [ ] Bump version in `manifest.config.ts`.
- [ ] Run type-check.
- [ ] Run release build.
- [ ] Load unpacked and smoke test.
- [ ] Upload new zip.
- [ ] Add release notes.
- [ ] Submit update for review.
