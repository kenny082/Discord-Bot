import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } from '@discordjs/voice';
import { exec } from 'child_process';

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

// Command handler for text-based ping and Valorant commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore bot messages
  console.log("Received message:", message.content);

  // New command to join VC and play 'God Plan' song
  if (message.content === 'godplan') {
    // Check if the user is in a voice channel
    const userVoiceChannel = message.member?.voice.channel;
    if (!userVoiceChannel) {
      return message.channel.send('You need to join a voice channel first!');
    }

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: userVoiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("Bot has successfully connected to the channel.");
    });

    // Execute yt-dlp to get audio stream for the God Plan music video
    const MUSIC_URL = 'https://www.youtube.com/watch?v=m1a_GqJf02M';
    const stream = exec(`yt-dlp -f bestaudio --no-warnings -g ${MUSIC_URL}`, (error, stdout, stderr) => {
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
      });

      // Error handling for the player
      player.on('error', (error) => {
        console.error('Audio player error:', error);
      });
    });

    // Error handling for yt-dlp
    stream.on('error', (error) => {
      console.error('Stream error:', error);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);