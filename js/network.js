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
