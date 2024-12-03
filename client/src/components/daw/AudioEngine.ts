import * as Tone from 'tone';

let synth: Tone.PolySynth;
const samplePlayers = new Map<string, Tone.Player>();

export const initAudioEngine = async () => {
  await Tone.start();
  synth = new Tone.PolySynth(Tone.Synth).toDestination();
  
  // Initialize default samples
  const defaultSamples = [
    { name: 'kick', url: '/samples/kick.wav' },
    { name: 'snare', url: '/samples/snare.wav' },
    { name: 'hihat', url: '/samples/hihat.wav' },
  ];

  await Promise.all(
    defaultSamples.map(async ({ name, url }) => {
      const player = new Tone.Player(url).toDestination();
      await player.load();
      samplePlayers.set(name, player);
    })
  );
};

export const playNote = (frequency: number) => {
  synth?.triggerAttack(frequency);
};

export const stopNote = () => {
  synth?.triggerRelease();
};

export const playSample = async (name: string) => {
  const player = samplePlayers.get(name);
  if (player) {
    player.start();
  }
};

export const loadSample = async (name: string, url: string) => {
  const player = new Tone.Player(url).toDestination();
  await player.load();
  samplePlayers.set(name, player);
  return player;
};
