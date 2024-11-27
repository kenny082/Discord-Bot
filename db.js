import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType, AudioPlayer } from '@discordjs/voice';
import { exec } from 'child_process';

const valorantPlayers = [
  '<@323872822340616202>',
  '<@300336822930636802>',
  '<@161275448356110337>',
  '<@303192973636534272>',
  '<@485627373484507147>',
  '<@206204815104147458>',
  '<@519287093474885662>',
  '<@453730860886392832>',
  '<@139105401756057600>',
];

// Set up the Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.login(process.env.DISCORD_TOKEN);

// Create a map to store player states (playing, paused, connection)
const playerStates = new Map();

// Command handler for text-based ping and Valorant commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore bot messages
  console.log("Received message:", message.content);

  // 'valping' command: Pings the list of Valorant players
  if (message.content === 'valping') {
    message.channel.send(`Hey ${valorantPlayers.join(' ')}, Valorant?`);
  }

  // 'test' command: Sends a simple "Hello World" message
  if (message.content === 'test') {
    message.channel.send("Hello World");
  }

  // Command to play a YouTube video in a voice channel
  if (message.content.startsWith('play ')) {
    const youtubeLink = message.content.split(' ')[1];  // Extract the YouTube link after 'play '

    if (!youtubeLink) {
      message.channel.send('Please provide a valid YouTube link.');
      return;
    }

    // Check if the link is a valid YouTube URL
    const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|.*\/)([a-zA-Z0-9_-]+)$/;
    if (!youtubeUrlPattern.test(youtubeLink)) {
      message.channel.send('Please provide a valid YouTube link.');
      return;
    }

    // Get the user who sent the command and check if they are in a voice channel
    const userId = message.author.id;
    const channel = message.guild.members.cache.get(userId)?.voice.channel;

    if (!channel) {
      message.channel.send('You need to be in a voice channel first.');
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("Bot has successfully connected to the channel.");
    });

    // Execute yt-dlp to get audio stream from the YouTube link
    const stream = exec(`yt-dlp -f bestaudio --no-warnings -g ${youtubeLink}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }

      const audioUrl = stdout.trim(); // This is the direct URL to the audio stream
      console.log(`Audio URL: ${audioUrl}`);

      // Create audio resource from the stream URL
      const resource = createAudioResource(audioUrl, {
        inputType: StreamType.Opus,
      });

      // Create audio player and play the resource
      const player = createAudioPlayer();
      player.play(resource);

      // Subscribe to the player to play the music
      connection.subscribe(player);

      // Handle player events
      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        console.log("The song has ended. Leaving the voice channel.");
        playerStates.delete(message.guild.id); // Remove the player state when the song ends
      });

      // Error handling for the player
      player.on('error', (error) => {
        console.error('Audio player error:', error);
        message.channel.send('Error playing the audio.');
      });

      // Save the player state
      playerStates.set(message.guild.id, {
        player,
        connection,
        youtubeLink,
      });
    });

    // Error handling for yt-dlp
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      message.channel.send('Error fetching audio from YouTube.');
    });
  }

  // 'bresume' command: Resumes the audio if it's paused
  if (message.content === 'bresume') {
    const state = playerStates.get(message.guild.id);
    if (!state) {
      message.channel.send('No audio is currently paused.');
      return;
    }

    const { player } = state;
    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause(); // Resumes the music
      message.channel.send('Resuming the music...');
    } else {
      message.channel.send('The music is already playing.');
    }
  }

  // 'bstop' command: Pauses the audio
  if (message.content === 'bstop') {
    const state = playerStates.get(message.guild.id);
    if (!state) {
      message.channel.send('No audio is currently playing.');
      return;
    }

    const { player } = state;
    if (player.state.status === AudioPlayerStatus.Playing) {
      player.pause(); // Pauses the music
      message.channel.send('Pausing the music...');
    } else {
      message.channel.send('The music is already paused.');
    }
  }

  // 'bleave' command: Makes the bot leave the voice channel
  if (message.content === 'bleave') {
    const state = playerStates.get(message.guild.id);
    if (!state) {
      message.channel.send('I am not in a voice channel.');
      return;
    }

    const { connection } = state;
    connection.destroy(); // Disconnect from the voice channel
    message.channel.send('Leaving the voice channel...');
    playerStates.delete(message.guild.id); // Remove the player state
  }

  // "botupdate" command to send the latest changes from the 'patch' file
  if (message.content === 'botupdate') {
    const patchFilePath = './patch.txt';  // Modify this path if the file is in a different location

    // Check if the patch file exists
    if (fs.existsSync(patchFilePath)) {
      fs.readFile(patchFilePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading patch file:', err);
          message.channel.send('Sorry, there was an error fetching the updates.');
        } else {
          message.channel.send(`Here are the latest updates:\n\n${data}`);
        }
      });
    } else {
      message.channel.send('Patch file not found.');
    }
  }
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);