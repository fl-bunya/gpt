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

app.event("app_mention", async ({ event, say }) => {
  try {
    const { text, channel, thread_ts, ts } = event;

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
    const newReply = await chat(prompt, history);

    await say({
      text: newReply,
      thread_ts: thread_ts || ts,
      icon_emoji: ':smiley:',
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
