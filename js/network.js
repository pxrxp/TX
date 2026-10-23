const APP_PREFIX = 'pxrxp/tx/';
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

export class NetworkManager {
  constructor(onRemoteSignal, onRemoteMessage) {
    this.onRemoteSignal = onRemoteSignal;
    this.onRemoteMessage = onRemoteMessage;
    this.client = null;
    this.clientId = `${APP_PREFIX}_${Math.random().toString(16).substring(2, 10)}`;
    this.room = '';
    this.callsign = '';
  }

  getMqttLibrary() {
    if (typeof window !== 'undefined' && window.mqtt) return window.mqtt;
    if (typeof mqtt !== 'undefined') return mqtt;
    throw new Error('MQTT library not loaded. Ensure mqtt script is included in index.html.');
  }

  async connect() {
    if (this.client && this.client.connected) return;

    const mqttLib = this.getMqttLibrary();

    if (this.client) {
      try { this.client.end(true); } catch (e) {}
    }

    console.log(`[Telegraph] Connecting to unified broker: ${BROKER_URL}`);

    this.client = mqttLib.connect(BROKER_URL, {
      clientId: this.clientId,
      clean: true,
      connectTimeout: 7000,
      reconnectPeriod: 3000
    });

    this.attachListeners();

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Broker connection timeout')), 8000);

      const onConnect = () => {
        clearTimeout(timeout);
        this.client.removeListener('error', onError);
        console.log('[Telegraph] Connected to MQTT broker');
        resolve();
      };

      const onError = (err) => {
        clearTimeout(timeout);
        this.client.removeListener('connect', onConnect);
        reject(err || new Error('MQTT connection error'));
      };

      if (this.client.connected) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.client.once('connect', onConnect);
        this.client.once('error', onError);
      }
    });
  }

  attachListeners() {
    this.client.on('connect', () => {
      if (this.room) {
        this.subscribeToRoomTopics();
      }
    });

    this.client.on('message', (topic, payload) => {
      if (!topic.startsWith(APP_PREFIX)) return;

      try {
        const data = JSON.parse(payload.toString());

        // Presence check query
        if (topic === `${APP_PREFIX}/${this.room}/presence/ping`) {
          if (data.query && this.callsign && data.query.toLowerCase() === this.callsign.toLowerCase()) {
            if (data.clientId !== this.clientId) {
              this.client.publish(
                `${APP_PREFIX}/${this.room}/presence/claim`,
                JSON.stringify({ callsign: this.callsign, clientId: this.clientId })
              );
            }
          }
          return;
        }

        // Ignore local loopback by unique Client ID
        if (data.clientId && data.clientId === this.clientId) return;

        if (topic.endsWith('/signal')) {
          this.onRemoteSignal(data.action);
        } else if (topic.endsWith('/chat')) {
          console.log('[Telegraph] Incoming chat:', data.sender, data.decoded);
          this.onRemoteMessage(data.sender, data.rawMorse, data.decoded);
        }
      } catch (e) {
        console.error('[Telegraph] Message handling error:', e);
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
          console.log(`[Telegraph] Subscribed to channel: ${this.room}`);
          resolve();
        }
      });
    });
  }

  async checkCallsignAvailability(room, callsign) {
    await this.connect();

    return new Promise((resolve) => {
      const targetRoom = room.toLowerCase();
      const pingTopic = `${APP_PREFIX}/${targetRoom}/presence/ping`;
      const claimTopic = `${APP_PREFIX}/${targetRoom}/presence/claim`;
      let isTaken = false;

      const handler = (topic, payload) => {
        if (topic === claimTopic) {
          try {
            const msg = JSON.parse(payload.toString());
            if (msg.callsign && msg.callsign.toLowerCase() === callsign.toLowerCase()) {
              if (msg.clientId !== this.clientId) {
                isTaken = true;
              }
            }
          } catch (e) {}
        }
      };

      this.client.subscribe(claimTopic, (err) => {
        if (!err) {
          this.client.on('message', handler);
          this.client.publish(pingTopic, JSON.stringify({ query: callsign, clientId: this.clientId }));
        }
      });

      setTimeout(() => {
        if (this.client) {
          this.client.unsubscribe(claimTopic);
          this.client.removeListener('message', handler);
        }
        resolve(!isTaken);
      }, 500);
    });
  }

  async joinRoom(room, callsign) {
    await this.connect();

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
      this.client.publish(topic, payload);
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
      console.log(`[Telegraph] Transmitting message to ${topic}`);
      this.client.publish(topic, payload, { qos: 0 });
    } else {
      console.warn('[Telegraph] Cannot transmit: Client disconnected or room not joined');
    }
  }
}
