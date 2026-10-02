# Smart Study Planner

A complete hackathon-ready study planning web application for **REVA University – Abhinava Hackathon 2026**.

## Features

- Add, edit and delete subjects
- Set exam dates, difficulty and target revision hours
- Automatically generate a day-by-day revision timetable
- Deadline and difficulty-based scheduling
- Exam countdown
- Daily checklist
- Completion tracking
- Progress analytics and charts
- LocalStorage persistence
- Responsive mobile and desktop UI
- Demo data loader for presentation

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js CDN
- Browser LocalStorage

No backend or database is required for the prototype.

## Run locally

Simply open `index.html` in a browser.

For VS Code, you can use the Live Server extension.

## Deploy

### GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Go to **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select `main` and `/root`.
6. Save and wait for the deployment.

### Vercel
1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: `.`
6. Deploy.

## Demo flow

1. Open the dashboard.
2. Click **Load Demo Data**.
3. Show the automatically generated timetable.
4. Open **Subjects** and explain difficulty, exam date and target hours.
5. Go to **Smart Planner**.
6. Complete a few tasks.
7. Open **Progress** and show the charts.
8. Add a new subject live if judges ask for customization.

## Future improvements

- Login/authentication
- Firebase/cloud synchronization
- AI-generated study recommendations
- Notifications/reminders
- Calendar integration
- Pomodoro timer
- Teacher/admin dashboard
