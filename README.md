# DETAILIO Business portal

Next.js portal for detailers (and a thin admin area for you), styled to match the DETAILIO website. It uses the platform database from `detailio-database`.

## What's in it

- **Sign up and sign in** (email and password, with email confirmation)
- **Set-up wizard:** business details and booking rules, address and service area (UK postcode lookup), services and prices, opening hours, document upload, review and submit
- **Dashboard:** status, requests waiting, upcoming bookings, rating, next appointments
- **Bookings:** accept or decline requests (with the reply deadline), upcoming and past lists
- **Admin** (visible only to users in the `admins` table): list applications, open the documents, approve or reject each document, then approve, reject or suspend the business. Every action is written to the audit log by the database.

## Run it

```bash
npm install
cp .env.example .env.local     # add your Supabase URL and anon key
npm run dev                    # http://localhost:3001
```

## Supabase settings

1. Run the four migrations from `detailio-database` first.
2. Authentication > URL configuration: set the Site URL to where you host this portal, and add `<portal-url>/auth/callback` to the redirect URLs.
3. Make yourself an admin: `insert into public.admins (user_id) values ('<your user id>');`

## Deploy

Deploy to Vercel as a second project (for example at `business.getdetailio.co.uk`). Add the three variables from `.env.example`.

## Not built yet

Earnings and payouts (needs Stripe), vehicle-size pricing and add-ons, blocked dates, customer list, review replies, analytics, staff accounts and extra locations (Studio plan), subscription upgrades, and the logo upload and gallery photos for the storefront.

## Check after deploying

1. Create an account, set up a business, upload three documents, submit.
2. Sign in as your admin account, open the application, approve each document, then approve the business.
3. Sign in again as the business and confirm the dashboard shows Approved.
4. Sign in with a second account and confirm it cannot see the first business's data.
