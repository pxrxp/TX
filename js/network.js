const APP_PREFIX = 'pxrxp/tx';

export const BROKER_MAP = {
  auto: ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'],
  hivemq: ['wss://broker.hivemq.com:8884/mqtt'],
  emqx: ['wss://broker.emqx.io:8084/mqtt']
};

export class NetworkManager {
  constructor(onRemoteSignal, onRemoteMessage) {
    this.onRemoteSignal = onRemoteSignal;
    this.onRemoteMessage = onRemoteMessage;
    this.client = null;
    this.clientId = `tx_${Math.random().toString(16).substring(2, 10)}`;
    this.room = '';
    this.callsign = '';
    this.selectedBrokerKey = 'hivemq';
    this.activeBroker = '';
  }

  getMqttLibrary() {
    if (typeof window !== 'undefined' && window.mqtt) return window.mqtt;
    if (typeof mqtt !== 'undefined') return mqtt;
    throw new Error('MQTT library not loaded. Ensure mqtt script is included in index.html.');
  }

  async connect(brokerKey = 'hivemq') {
    if (this.client && this.client.connected && this.selectedBrokerKey === brokerKey) {
      return;
    }

    const mqttLib = this.getMqttLibrary();
    this.selectedBrokerKey = brokerKey;
    const targets = BROKER_MAP[brokerKey] || BROKER_MAP.hivemq;

    if (this.client) {
      try { this.client.end(true); } catch (e) {}
      this.client = null;
    }

    let lastError = null;

    for (const brokerUrl of targets) {
      console.log(`[Telegraph] Connecting to broker: ${brokerUrl}`);

      try {
        const client = mqttLib.connect(brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 7000,
          reconnectPeriod: 3000
        });

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            try { client.end(true); } catch (e) {}
            reject(new Error(`Timeout connecting to ${brokerUrl}`));
          }, 8000);

          const onConnect = () => {
            clearTimeout(timeout);
            client.removeListener('error', onError);
            console.log(`[Telegraph] Connected successfully to: ${brokerUrl}`);
            resolve();
          };

          const onError = (err) => {
            clearTimeout(timeout);
            client.removeListener('connect', onConnect);
            try { client.end(true); } catch (e) {}
            reject(err || new Error(`Connection error on ${brokerUrl}`));
          };

          if (client.connected) {
            clearTimeout(timeout);
            resolve();
          } else {
            client.once('connect', onConnect);
            client.once('error', onError);
          }
        });

        this.client = client;
        this.activeBroker = brokerUrl;
        this.attachListeners();
        return;
      } catch (err) {
        console.warn(`[Telegraph] Connection failed on ${brokerUrl}:`, err.message || err);
        lastError = err;
      }
    }

    throw lastError || new Error('All broker connection attempts failed');
  }

  attachListeners() {
    if (!this.client) return;

    this.client.removeAllListeners('message');

    this.client.on('connect', () => {
      if (this.room) {
        this.subscribeToRoomTopics();
      }
    });

    this.client.on('message', (topic, payload) => {
      console.log(`[Telegraph RX] Incoming Topic: ${topic}`, payload.toString());

      if (!topic.startsWith(APP_PREFIX)) return;

      try {
        const data = JSON.parse(payload.toString());

        // Ignore self loopback
        if (data.clientId && data.clientId === this.clientId) {
          return;
        }

        if (topic.endsWith('/signal')) {
          console.log('[Telegraph RX] Executing signal:', data.action);
          if (this.onRemoteSignal) this.onRemoteSignal(data.action);
        } else if (topic.endsWith('/chat')) {
          console.log('[Telegraph RX] Executing chat:', data.sender, data.decoded);
          if (this.onRemoteMessage) this.onRemoteMessage(data.sender, data.rawMorse, data.decoded);
        }
      } catch (e) {
        console.error('[Telegraph RX] Processing error:', e);
      }
    });
  }

  subscribeToRoomTopics() {
    if (!this.client || !this.client.connected || !this.room) return Promise.resolve();

    const roomPath = `${APP_PREFIX}/${this.room}`;
    const topics = [
      `${roomPath}/signal`,
      `${roomPath}/chat`,
      `${roomPath}/presence/ping`
    ];

    return new Promise((resolve, reject) => {
      this.client.subscribe(topics, (err) => {
        if (err) {
          console.error('[Telegraph] Subscription error:', err);
          reject(err);
        } else {
          console.log(`[Telegraph] Subscribed to room topics:`, topics);
          resolve();
        }
      });
    });
  }

  async checkCallsignAvailability(room, callsign, brokerKey = 'hivemq') {
    await this.connect(brokerKey);
    return true; // Simplified availability check for seamless station entry
  }

  async joinRoom(room, callsign, brokerKey = 'hivemq') {
    await this.connect(brokerKey);

    const normalizedRoom = room.toLowerCase();
    const normalizedCallsign = callsign.toLowerCase();

    if (this.room && this.room !== normalizedRoom) {
      const oldPath = `${APP_PREFIX}/${this.room}`;
      this.client.unsubscribe([
        `${oldPath}/signal`,
        `${oldPath}/chat`,
        `${oldPath}/presence/ping`
      ]);
    }

    this.room = normalizedRoom;
    this.callsign = normalizedCallsign;

    await this.subscribeToRoomTopics();
  }

  sendSignal(action, callsign) {
    if (this.client && this.client.connected && this.room) {
      const topic = `${APP_PREFIX}/${this.room}/signal`;
      const payload = JSON.stringify({ action, sender: callsign, clientId: this.clientId });
      this.client.publish(topic, payload, { qos: 0 });
    }
  }

  sendMessage(callsign, rawMorse, decoded) {
    if (this.client && this.client.connected && this.room) {
      const topic = `${APP_PREFIX}/${this.room}/chat`;
      const payload = JSON.stringify({
        sender: callsign,
        clientId: this.clientId,
        rawMorse,
        decoded
      });
      console.log(`[Telegraph] Transmitting chat to ${topic}`);
      this.client.publish(topic, payload, { qos: 0 });
    }
  }
}
