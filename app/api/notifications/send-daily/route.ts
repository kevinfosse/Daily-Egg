/* import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@pokedaily.com";

async function getWebPush() {
  const webpush = await import("web-push");
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
  return webpush;
}

// POST - Send daily egg ready notifications (cron endpoint)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VAPID keys not configured" },
        { status: 500 }
      );
    }

    await connectToDb();

    // Get today's date at midnight UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find users who:
    // 1. Have push subscriptions
    // 2. Have dailyEggReminder enabled (or not set, defaulting to true)
    // 3. Haven't hatched today (lastHatchDate < today or null)
    const usersToNotify = await User.find({
      pushSubscriptions: { $exists: true, $ne: [] },
      $and: [
        {
          $or: [
            { "notificationPreferences.dailyEggReminder": true },
            { "notificationPreferences.dailyEggReminder": { $exists: false } },
          ],
        },
        {
          $or: [
            { lastHatchDate: { $lt: today } },
            { lastHatchDate: null },
          ],
        },
      ],
    });

    const payload = JSON.stringify({
      title: "PokéDaily",
      body: "Votre oeuf journalier est pret a eclore !",
      url: "/",
    });

    // Get web-push module dynamically
    const webpush = await getWebPush();

    let sent = 0;
    let failed = 0;
    const failedEndpoints: string[] = [];

    // Send notifications to all subscribed users
    for (const user of usersToNotify) {
      for (const subscription of user.pushSubscriptions || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
              },
            },
            payload
          );
          sent++;
        } catch (error: any) {
          failed++;
          // If subscription is invalid (410 Gone), mark for removal
          if (error.statusCode === 410 || error.statusCode === 404) {
            failedEndpoints.push(subscription.endpoint);
          }
          console.error(
            `Failed to send notification to ${user.email}:`,
            error.message
          );
        }
      }
    }

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await User.updateMany(
        { "pushSubscriptions.endpoint": { $in: failedEndpoints } },
        { $pull: { pushSubscriptions: { endpoint: { $in: failedEndpoints } } } }
      );
    }

    return NextResponse.json({
      message: "Notifications envoyées",
      stats: {
        usersFound: usersToNotify.length,
        sent,
        failed,
        cleanedUp: failedEndpoints.length,
      },
    });
  } catch (error) {
    console.error("Send daily notifications error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi des notifications" },
      { status: 500 }
    );
  }
}
 */