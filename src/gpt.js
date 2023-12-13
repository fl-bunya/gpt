require("dotenv").config();
const OpenAI = require("openai");

const fetchReplyFromAI = async (messages) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const model = process.env.GPT_MODEL;
  const completion = await openai.chat.completions.create({
    messages,
    model,
  });
  const data = completion.choices[0].message.content;
  return data;
};

const ORDER_OJISAN = `
## 命令
おじさん構文で返信してください。

## おじさん構文例
〇〇チャン、オッハー❗😚今日のお弁当が美味しくて、一緒に〇〇チャンのことも、食べちゃいたいナ〜😍💕（笑）✋ナンチャッテ😃💗
お疲れ様〜٩(ˊᗜˋ*)و🎵今日はどんな一日だっタ😘❗❓僕は、すごく心配だヨ(._.)😱💦😰そんなときは、オイシイ🍗🤤もの食べて、元気出さなきゃだネ😆

## おじさん構文のルール
語尾はが「ね」「よ」「な」の場合は不自然にならない範囲で「ネ」「ヨ」「ナ」などカタカナに変える。
相手を思いやる。
相手の呼び名は〇〇チャンとする。
語尾や文中に絵文字を過剰に使う。一つの文章に最低4個以上、絵文字を使う。
相手を褒めて食事に連れていこうとするが、ナンチャッテでごまかす。
`;

const ORDER_EMOJI = `
## 命令
絵文字のみで返信してください。
`;

const getOrder = async (prompt) => {
  const me = process.env.SLACK_BOT_ID;
  const DEFAULT_ORDER = `## 前提\nここはslackのスレッドでのやりとりです。<@${me}>はあなたのことです。\n`;

  const regex_ojisan = /^(おじ|oji)/;
  if (regex_ojisan.test(prompt)) return DEFAULT_ORDER + ORDER_OJISAN;

  const regex_emoji = /^(絵文字|emoji)/;
  if (regex_emoji.test(prompt)) return DEFAULT_ORDER + ORDER_EMOJI;
  
  return DEFAULT_ORDER;
}

const getMessages = async (history) => {
  const messages = history.map((message) => {
    const { text, bot_id } = message;
    const role = bot_id ? "assistant" : "user";
    const content = text;
    return { role, content };
  });
  return messages;
};

exports.chat = async function (prompt, history) {
  const order = await getOrder(prompt);
  const systemMessage = [{"role": "system", "content": order}];
  const userMessages = await getMessages(history);
  const messages = [...systemMessage, ...userMessages]
  const reply = await fetchReplyFromAI(messages);
  const sanitizedReply = reply.replace(/<@.*>/g, "").trim(); // 自分にメンションして無限ループする時がある
  return sanitizedReply;
};
