const APP_PREFIX = 'pxrxp/tx/';

export class NetworkManager {
  constructor(onRemoteSignal, onRemoteMessage) {
    this.onRemoteSignal = onRemoteSignal;
    this.onRemoteMessage = onRemoteMessage;
    this.client = null;
    this.room = '';
    this.callsign = '';
  }

  getMqttLibrary() {
    if (typeof window !== 'undefined' && window.mqtt) {
      return window.mqtt;
    }
    if (typeof mqtt !== 'undefined') {
      return mqtt;
    }
    throw new Error('MQTT library not loaded from CDN. Check script tags in index.html.');
  }

  async connect() {
    if (this.client && this.client.connected) return;

    const mqttLib = this.getMqttLibrary();
    const clientId = `${APP_PREFIX}_${Math.random().toString(16).substring(2, 10)}`;

    const brokers = [
      'wss://broker.hivemq.com:8884/mqtt',
      'wss://broker.emqx.io:8084/mqtt'
    ];

    let lastError = null;

    for (const brokerUrl of brokers) {
      try {
        console.log(`[Telegraph] Attempting connection to: ${brokerUrl}`);

        if (this.client) {
          try {
            this.client.end(true);
          } catch (e) {}
        }

        const client = mqttLib.connect(brokerUrl, {
          clientId: clientId,
          clean: true,
          connectTimeout: 5000,
          reconnectPeriod: 3000
        });

        // Attach message & reconnect listeners directly to this client instance
        this.attachClientListeners(client);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

          const onConnect = () => {
            clearTimeout(timeout);
            client.removeListener('error', onError);
            console.log(`[Telegraph] Connected successfully to ${brokerUrl}`);
            resolve();
          };

          const onError = (err) => {
            clearTimeout(timeout);
            client.removeListener('connect', onConnect);
            reject(err || new Error('Connection failed'));
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
        return; // Connection successful
      } catch (err) {
        console.warn(`[Telegraph] Failed broker ${brokerUrl}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('Could not connect to any MQTT broker');
  }

  attachClientListeners(client) {
    client.on('connect', () => {
      console.log('[Telegraph] Connected / Reconnected to MQTT broker');
      if (this.room) {
        this.resubscribeRoom();
      }
    });

    client.on('message', (topic, payload) => {
      console.log('[Telegraph] Received topic message:', topic, payload.toString());
      if (!topic.startsWith(APP_PREFIX)) return;

      try {
        const data = JSON.parse(payload.toString());

        // Handle callsign reservation ping
        if (topic === `${APP_PREFIX}/${this.room}/presence/ping`) {
          if (data.query && this.callsign && data.query.toLowerCase() === this.callsign.toLowerCase()) {
            client.publish(
              `${APP_PREFIX}/${this.room}/presence/claim`,
              JSON.stringify({ callsign: this.callsign })
            );
          }
          return;
        }

        // Prevent loopback self messages
        if (data.sender && data.sender.toLowerCase() === this.callsign.toLowerCase()) {
          return;
        }

        if (topic.endsWith('/signal')) {
          this.onRemoteSignal(data.action);
        } else if (topic.endsWith('/chat')) {
          console.log('[Telegraph] Rendering remote message from:', data.sender);
          this.onRemoteMessage(data.sender, data.rawMorse, data.decoded);
        }
      } catch (e) {
        console.error('[Telegraph] Error processing incoming payload:', e);
      }
    });
  }

  resubscribeRoom() {
    if (!this.client || !this.client.connected || !this.room) return;
    const roomPath = `${APP_PREFIX}/${this.room}`;

    this.client.subscribe(`${roomPath}/signal`);
    this.client.subscribe(`${roomPath}/chat`);
    this.client.subscribe(`${roomPath}/presence/ping`);
    console.log(`[Telegraph] Subscribed to channel: ${this.room}`);
  }

  async checkCallsignAvailability(room, callsign) {
    await this.connect();

    return new Promise((resolve) => {
      const pingTopic = `${APP_PREFIX}/${room.toLowerCase()}/presence/ping`;
      const claimTopic = `${APP_PREFIX}/${room.toLowerCase()}/presence/claim`;
      let isTaken = false;

      const handler = (topic, payload) => {
        if (topic === claimTopic) {
          try {
            const msg = JSON.parse(payload.toString());
            if (msg.callsign && msg.callsign.toLowerCase() === callsign.toLowerCase()) {
              isTaken = true;
            }
          } catch (e) {}
        }
      };

      this.client.subscribe(claimTopic, (err) => {
        if (!err) {
          this.client.on('message', handler);
          this.client.publish(pingTopic, JSON.stringify({ query: callsign }));
        }
      });

      setTimeout(() => {
        if (this.client) {
          this.client.unsubscribe(claimTopic);
          this.client.removeListener('message', handler);
        }
        resolve(!isTaken);
      }, 600);
    });
  }

  async joinRoom(room, callsign) {
    await this.connect();

    const normalizedRoom = room.toLowerCase();
    const normalizedCallsign = callsign.toLowerCase();

    if (this.room && this.room !== normalizedRoom && this.client) {
      const oldPath = `${APP_PREFIX}/${this.room}`;
      this.client.unsubscribe(`${oldPath}/signal`);
      this.client.unsubscribe(`${oldPath}/chat`);
      this.client.unsubscribe(`${oldPath}/presence/ping`);
    }

    this.room = normalizedRoom;
    this.callsign = normalizedCallsign;

    this.resubscribeRoom();
  }

  sendSignal(action, callsign) {
    if (this.client && this.client.connected) {
      const topic = `${APP_PREFIX}/${this.room}/signal`;
      const payload = JSON.stringify({ action, sender: callsign });
      this.client.publish(topic, payload);
    }
  }

  sendMessage(callsign, rawMorse, decoded) {
    if (this.client && this.client.connected) {
      const topic = `${APP_PREFIX}/${this.room}/chat`;
      const payload = JSON.stringify({ sender: callsign, rawMorse, decoded });
      console.log(`[Telegraph] Publishing message to ${topic}:`, payload);
      this.client.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) console.error('[Telegraph] Publish error:', err);
      });
    } else {
      console.warn('[Telegraph] Cannot send: MQTT client disconnected.');
    }
  }
}
