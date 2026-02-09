This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Toggl Setup

1. Copy `.env.local.example` to `.env.local`.
2. Add each teammate's personal Toggl API token in the JSON array.

Example:

```bash
TOGGL_TEAM='[
  {"name": "Alice", "token": "your-token-here"},
  {"name": "Bob", "token": "your-token-here"}
]'
```

Restart the dev server after editing `.env.local`.

## Features

- Daily summary per task description.
- Teammate search with saved filters stored in local storage.
- Team overview mode for the whole group.
- Light server-side caching with basic rate-limit handling.

## Notes

- Tokens are read on the server only and never sent to the browser.
- The dashboard queries Toggl's API for the selected teammate and date.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
