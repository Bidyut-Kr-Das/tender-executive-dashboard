import amqplib, { type Channel, type ChannelModel } from "amqplib";

let model: ChannelModel | null = null;
let channel: Channel | null = null;

async function getModel(): Promise<ChannelModel | null> {
  const url = process.env.RABBITMQ_URL;
  if (!url) return null;

  if (model) return model;

  try {
    model = await amqplib.connect(url);
    model.on("error", (err: Error) => {
      console.error("[RabbitMQ] Connection error:", err);
      model = null;
      channel = null;
    });
    model.on("close", () => {
      console.log("[RabbitMQ] Connection closed");
      model = null;
      channel = null;
    });
    return model;
  } catch (err) {
    console.error("[RabbitMQ] Failed to connect:", err);
    return null;
  }
}

export async function getChannel(): Promise<Channel | null> {
  if (channel) return channel;

  const m = await getModel();
  if (!m) return null;

  try {
    channel = await m.createChannel();
    channel.on("error", (err: Error) => {
      console.error("[RabbitMQ] Channel error:", err);
      channel = null;
    });
    channel.on("close", () => {
      console.log("[RabbitMQ] Channel closed");
      channel = null;
    });
    return channel;
  } catch (err) {
    console.error("[RabbitMQ] Failed to create channel:", err);
    return null;
  }
}

/** Ready messages and listening workers per queue; null for one that cannot be checked. */
export async function checkQueues(
  names: string[],
): Promise<({ ready: number; workers: number } | null)[]> {
  const m = await getModel();
  if (!m) return names.map(() => null);
  return Promise.all(
    names.map(async (name) => {
      // Own channel: checking a queue that does not exist closes the channel it ran on.
      let ch: Channel | null = null;
      try {
        ch = await m.createChannel();
        ch.on("error", () => {});
        const { messageCount, consumerCount } = await ch.checkQueue(name);
        return { ready: messageCount, workers: consumerCount };
      } catch {
        return null;
      } finally {
        await ch?.close().catch(() => {});
      }
    }),
  );
}

export async function closeConnection(): Promise<void> {
  try {
    await channel?.close();
    await model?.close();
  } catch {
    // ignore cleanup errors
  } finally {
    channel = null;
    model = null;
  }
}
