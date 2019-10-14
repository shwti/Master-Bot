const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const ytdl = require('ytdl-core');
const fs = require('fs');

var quizQueue = [];
var score = [];
var usersPlaying = new Set();

module.exports = class MusicTriviaCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'music-trivia',
      memberName: 'music-trivia',
      group: 'music',
      description: "Engage in a 2000's music quiz with your friends!",
      guildOnly: true,
      clientPermissions: ['SPEAK', 'CONNECT'],
      throttling: {
        usages: 1,
        duration: 10
      }
    });
  }
  async run(message) {
    // check if user is in a voice channel
    var voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.say('Please join a voice channel and try again');
    if (this.client.isPlaying === true)
      return message.channel.send('A trivia or a song is already running');
    this.client.isPlaying = true;
    this.client.isTriviaRunning = true;
    // fetch link array from txt file
    const Jsonsongs = fs.readFileSync(
      'resources/music/musictrivia.json',
      'utf8'
    );
    var videoDataArray = JSON.parse(Jsonsongs).songs;
    // get random x videos from array
    const randomXVideoLinks = this.getRandom(videoDataArray, 5); // get x random urls
    // create and send info embed
    const infoEmbed = new MessageEmbed()
      .setColor('#BADA55')
      .setTitle('Starting Music Quiz')
      .setDescription(
        'You have 30 seconds to guess the singer or band of each song, good luck!'
      );
    message.say(infoEmbed);
    // init quiz queue
    // turn each vid to song object
    for (let i = 0; i < randomXVideoLinks.length; i++) {
      const song = {
        url: randomXVideoLinks[i].url,
        singer: randomXVideoLinks[i].singer,
        title: randomXVideoLinks[i].title,
        voiceChannel
      };
      quizQueue.push(song);
    }
    const channelInfo = Array.from(
      message.member.voice.channel.members.entries()
    );
    channelInfo.forEach(user => {
      usersPlaying.add(user[1].user.username);
      score.push({ name: user[1].user.username, score: 0 });
    });
    this.playQuizSong(quizQueue, message);
  }

  playQuizSong(queue, message) {
    let voiceChannel;
    queue[0].voiceChannel.join().then(connection => {
      const dispatcher = connection
        .play(
          ytdl(queue[0].url, {
            quality: 'highestaudio',
            highWaterMark: 1024 * 1024 * 1024
          })
        )
        .on('start', () => {
          this.client.songDispatcher = dispatcher;
          voiceChannel = queue[0].voiceChannel;
          let songNameFound = false;
          let songSingerFound = false;

          const filter = m => usersPlaying.has(m.author.username);
          const collector = message.channel.createMessageCollector(filter, {
            time: 30000
          });

          collector.on('collect', m => {
            if (!usersPlaying.has(m.author.username)) return;
            if (m.content.startsWith('!')) return;
            // if user guessed song name
            if (m.content.toLowerCase() === queue[0].title) {
              for (let i = 0; i < score.length; i++) {
                songNameFound = true;
                if (songNameFound && songSingerFound) {
                  score[i].score++;
                  m.react('☑');
                  collector.stop();
                  break;
                }
                if (score[i].name === m.author.username) {
                  score[i].score++;
                  m.react('☑');
                  break;
                }
              }
            }
            // if user guessed singer
            else if (m.content.toLowerCase() === queue[0].singer) {
              songSingerFound = true;
              for (let i = 0; i < score.length; i++) {
                if (songNameFound && songSingerFound) {
                  score[i].score++;
                  m.react('☑');
                  collector.stop();
                  break;
                }
                if (score[i].name === m.author.username) {
                  score[i].score++;
                  m.react('☑');
                  break;
                }
              }
              // wrong answer
            } else {
              return m.react('❌');
            }
          });

          collector.on('end', () => {
            console.log(score);
            queue.shift();
            dispatcher.end();
          });
        })
        .on('end', () => {
          if (queue.length >= 1) {
            return this.playQuizSong(queue, message);
          } else {
            let highestScore = 0;
            let winner = '';
            for (let i = 0; i < score.length; i++) {
              if (score[i].score > highestScore) {
                highestScore = score[i].score;
                winner = score[i].name;
              }
            }
            if (highestScore === 0)
              return message.channel.send('No one won. Better luck next time');
            message.channel.send(
              `The winner is ${winner} with ${highestScore} points`
            );
            this.client.isPlaying = false;
            this.client.isTriviaRunning = false;
            score = [];
            usersPlaying.clear();
            return voiceChannel.leave();
          }
        });
    });
  }

  getRandom(arr, n) {
    var result = new Array(n),
      len = arr.length,
      taken = new Array(len);
    if (n > len)
      throw new RangeError('getRandom: more elements taken than available');
    while (n--) {
      var x = Math.floor(Math.random() * len);
      result[n] = arr[x in taken ? taken[x] : x];
      taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
  }
};