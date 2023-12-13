require("dotenv").config();
const { App, AwsLambdaReceiver } = require("@slack/bolt");
const { chat } = require("./gpt");

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};

function containsManyEmojis(str) {
  const SHRESHOLD = 3;
  
  const unicodeRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
  const unicodeEmojis = str.match(unicodeRegex);
  const unicodeCount = unicodeEmojis ? unicodeEmojis.length : 0;

  const slackRegex = /:[a-zA-Z0-9_+-]+:/g;
  const slackEmojis = str.match(slackRegex);
  const slackCount = slackEmojis ? slackEmojis.length : 0;

  const emojiCount = unicodeCount + slackCount;
  return emojiCount >= SHRESHOLD;
}

app.message(async ({ message, say }) => {
  try {
    // DM時のみ反応
    if (message.channel_type !== 'im' || message.bot_id) return;

    const { text, channel, thread_ts, ts, user } = message;

    const replies = await app.client.conversations.replies({
      channel,
      ts: thread_ts || ts,
    });
    const history = replies.messages.map((message) => {
      return {
        user: message?.user,
        text: message?.text,
        bot_id: message?.bot_id,
      }
    });

    const prompt = text.replace(/<@.*>/, "").trim();
    const newReply = await chat(prompt, history, user);

    await say({
      text: newReply,
      thread_ts: thread_ts || ts,
      icon_emoji: containsManyEmojis(newReply) ? ":kissing_heart:" : null,
    });
  } catch (error) {
    console.error("Error:", error);
    await say({
      text: `Sorry, an error occurred: ${error.message}`,
      thread_ts: message.ts,
    });
  }
});

// メンション
app.event("app_mention", async ({ event, say }) => {
  try {
    const { text, channel, thread_ts, ts, user } = event;

    const replies = await app.client.conversations.replies({
      channel,
      ts: thread_ts || ts,
    });
    const history = replies.messages.map((message) => {
      return {
        user: message?.user,
        text: message?.text,
        bot_id: message?.bot_id,
      }
    });

    const prompt = text.replace(/<@.*>/, "").trim();
    const newReply = await chat(prompt, history, user);

    await say({
      text: newReply,
      thread_ts: thread_ts || ts,
      icon_emoji: containsManyEmojis(newReply) ? ":kissing_heart:" : null,
    });
  } catch (error) {
    console.error("Error:", error);
    await say({
      text: `Sorry, an error occurred: ${error.message}`,
      thread_ts: event.ts,
    });
  }
});

// global middleware。すべての event action command の前に実行される。
app.use(async (args) => {
  const { context, next } = args;

  // リトライされたイベントであればスキップすべきかどうか判断する
  if (context.retryNum) {
    return;
  }

  await next();
});
