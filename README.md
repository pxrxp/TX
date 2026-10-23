# tx.

A virtual telegraph for talking to people in Morse code.

Join a channel, tap out a message, and see what comes back. You can watch the text as you go, or turn it off and try to copy everything by ear. It's also a handy way to get more comfortable with sending and reading Morse.

<img width="1781" height="1048" alt="image" src="https://github.com/user-attachments/assets/e6f6540e-7246-4b7a-b39f-dc9b20c62496" />
<img width="1781" height="1048" alt="image" src="https://github.com/user-attachments/assets/89d095c6-46da-4e71-9b51-b5e2a482fc4c" />

## Disclaimer

`tx.` uses a public MQTT broker for live communication. Messages and signals sent through the app may be visible to other people or accessible to third parties. Don't send anything private or sensitive. Use it as if anyone could be listening.

## How to use it

1. Join a channel or type in a room name.
2. Hold the spacebar or click the keyer to send Morse. On a phone, just tap it.
3. Listen for replies from other people on the same channel.
4. Use the decoder to check what you sent, or hide the translation if you want to practice by ear.

## Features

- Chat with others using Morse code.
- Hear your keying through a sidetone.
- See the dits, dahs, decoded text, and WPM as you send.
- Hide the translated text and try copying messages by ear.
- Look up letters, numbers, and symbols in the Morse chart.
- Adjust the sidetone pitch, decoder WPM, and auto-send delay.

## Controls

Short presses make dits; longer presses make dahs. The decoder uses the length of your key presses and the gaps between them to work out the characters.

You can change the sidetone pitch to whatever sounds comfortable. The WPM setting adjusts the decoder's timing, and the auto-send delay controls how long it waits after you finish keying before sending. If manual sending is enabled, you can choose when to send instead.

## Running locally

No build step or package installation needed. You'll just need Python to run a local server.

Clone the repo:

```bash
git clone https://github.com/your-username/tx.git
cd tx
```

Start the server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

Live chat needs an internet connection and a working MQTT broker configuration. The audio and other local features may work without one.

## Built with

- HTML and CSS
- Vanilla JavaScript
- Web Audio API
- MQTT over WebSockets
- Tailwind CSS

## License

MIT
