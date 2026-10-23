const APP_PREFIX = 'pxrxp/tx/';

export class NetworkManager {
  constructor(onRemoteSignal, onRemoteMessage) {
    this.onRemoteSignal = onRemoteSignal;
    this.onRemoteMessage = onRemoteMessage;
    this.client = null;
    this.room = '';
    this.callsign = '';
    this.isListenersSet = false;
  }

  async connect() {
    if (this.client && this.client.connected) return;

    if (!this.client) {
      const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
      const clientId = `${APP_PREFIX}_${Math.random().toString(16).substring(2, 10)}`;
      const mqttLib = window.mqtt || mqtt;

      this.client = mqttLib.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000
      });

      this.setupListeners();
    }

    if (!this.client.connected) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.client && this.client.connected) resolve();
          else reject(new Error('Broker connection timeout'));
        }, 6000);

        const onConnect = () => {
          clearTimeout(timer);
          this.client.removeListener('connect', onConnect);
          resolve();
        };

        if (this.client.connected) {
          clearTimeout(timer);
          resolve();
        } else {
          this.client.on('connect', onConnect);
        }
      });
    }
  }

  setupListeners() {
    if (this.isListenersSet) return;
    this.isListenersSet = true;

    this.client.on('connect', () => {
      if (this.room) {
        this.resubscribeRoom();
      }
    });

    this.client.on('message', (topic, payload) => {
      // Ignore messages from other applications on the public broker
      if (!topic.startsWith(APP_PREFIX)) return;

      try {
        const data = JSON.parse(payload.toString());

        // Presence query response
        if (topic === `${APP_PREFIX}/${this.room}/presence/ping`) {
          if (data.query && this.callsign && data.query.toLowerCase() === this.callsign.toLowerCase()) {
            this.client.publish(
              `${APP_PREFIX}/${this.room}/presence/claim`,
              JSON.stringify({ callsign: this.callsign })
            );
          }
          return;
        }

        // Ignore local loopback
        if (data.sender === this.callsign) return;

        if (topic.endsWith('/signal')) {
          this.onRemoteSignal(data.action);
        } else if (topic.endsWith('/chat')) {
          this.onRemoteMessage(data.sender, data.rawMorse, data.decoded);
        }
      } catch (e) {
        console.error('MQTT message error:', e);
      }
    });
  }

  resubscribeRoom() {
    if (!this.client || !this.room) return;
    this.client.subscribe(`${APP_PREFIX}/${this.room}/signal`);
    this.client.subscribe(`${APP_PREFIX}/${this.room}/chat`);
    this.client.subscribe(`${APP_PREFIX}/${this.room}/presence/ping`);
  }

  async checkCallsignAvailability(room, callsign) {
    await this.connect();

    return new Promise((resolve) => {
      const pingTopic = `${APP_PREFIX}/${room}/presence/ping`;
      const claimTopic = `${APP_PREFIX}/${room}/presence/claim`;
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

      this.client.subscribe(claimTopic, () => {
        this.client.on('message', handler);
        this.client.publish(pingTopic, JSON.stringify({ query: callsign }));
      });

      setTimeout(() => {
        this.client.unsubscribe(claimTopic);
        this.client.removeListener('message', handler);
        resolve(!isTaken);
      }, 500);
    });
  }

  async joinRoom(room, callsign) {
    await this.connect();

    if (this.room && this.room !== room) {
      this.client.unsubscribe(`${APP_PREFIX}/${this.room}/signal`);
      this.client.unsubscribe(`${APP_PREFIX}/${this.room}/chat`);
      this.client.unsubscribe(`${APP_PREFIX}/${this.room}/presence/ping`);
    }

    this.room = room;
    this.callsign = callsign;

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
      this.client.publish(topic, payload);
    }
  }
}
