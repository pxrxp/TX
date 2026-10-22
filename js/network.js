export class NetworkManager {
  constructor(onRemoteSignal, onRemoteMessage) {
    this.onRemoteSignal = onRemoteSignal;
    this.onRemoteMessage = onRemoteMessage;
    this.client = null;
    this.room = 'wire-01';
    this.callsign = '';
  }

  connect() {
    if (this.client) return;

    // Public WebSocket broker with secure fallback
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    const clientId = 'tx_' + Math.random().toString(16).substring(2, 10);

    this.client = mqtt.connect(brokerUrl, {
      clientId: clientId,
      clean: true,
      connectTimeout: 4000
    });

    this.client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (data.sender === this.callsign) return; // Prevent local loopback

        if (topic.endsWith('/signal')) {
          this.onRemoteSignal(data.action);
        } else if (topic.endsWith('/chat')) {
          this.onRemoteMessage(data.sender, data.rawMorse, data.decoded);
        }
      } catch (e) { }
    });
  }

  // MQTT Presence logic to reserve unique callsigns
  async checkCallsignAvailability(room, callsign) {
    if (!this.client || !this.client.connected) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return new Promise((resolve) => {
      const pingTopic = `tx/${room}/presence/ping`;
      const claimTopic = `tx/${room}/presence/claim`;
      let isTaken = false;

      const handler = (topic, payload) => {
        if (topic === claimTopic) {
          try {
            const msg = JSON.parse(payload.toString());
            if (msg.callsign && msg.callsign.toLowerCase() === callsign.toLowerCase()) {
              isTaken = true;
            }
          } catch (e) { }
        }
      };

      this.client.subscribe(claimTopic);
      this.client.on('message', handler);

      // Query active peers in target channel
      this.client.publish(pingTopic, JSON.stringify({ query: callsign }));

      setTimeout(() => {
        this.client.unsubscribe(claimTopic);
        this.client.removeListener('message', handler);
        resolve(!isTaken);
      }, 450);
    });
  }

  joinRoom(room, callsign) {
    if (this.room && this.client) {
      this.client.unsubscribe(`tx/${this.room}/signal`);
      this.client.unsubscribe(`tx/${this.room}/chat`);
      this.client.unsubscribe(`tx/${this.room}/presence/ping`);
    }

    this.room = room;
    this.callsign = callsign;

    if (this.client) {
      this.client.subscribe(`tx/${this.room}/signal`);
      this.client.subscribe(`tx/${this.room}/chat`);
      this.client.subscribe(`tx/${this.room}/presence/ping`);

      // Answer incoming callsign availability queries
      this.client.on('message', (topic, payload) => {
        if (topic === `tx/${this.room}/presence/ping`) {
          try {
            const data = JSON.parse(payload.toString());
            if (data.query && data.query.toLowerCase() === this.callsign.toLowerCase()) {
              this.client.publish(`tx/${this.room}/presence/claim`, JSON.stringify({ callsign: this.callsign }));
            }
          } catch (e) { }
        }
      });
    }
  }

  sendSignal(action, callsign) {
    if (this.client && this.client.connected) {
      const topic = `tx/${this.room}/signal`;
      const payload = JSON.stringify({ action, sender: callsign });
      this.client.publish(topic, payload);
    }
  }

  sendMessage(callsign, rawMorse, decoded) {
    if (this.client && this.client.connected) {
      const topic = `tx/${this.room}/chat`;
      const payload = JSON.stringify({ sender: callsign, rawMorse, decoded });
      this.client.publish(topic, payload);
    }
  }
}
