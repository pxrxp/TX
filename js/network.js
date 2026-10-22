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
  }
}
