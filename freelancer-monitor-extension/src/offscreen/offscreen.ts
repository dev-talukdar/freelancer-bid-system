function playGeneratedAlertTone(): void {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.35);
  oscillator.addEventListener('ended', () => void audioContext.close());
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === 'object' && message && 'type' in message && message.type === 'PLAY_ALERT_SOUND') {
    playGeneratedAlertTone();
  }
});
