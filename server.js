const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const fadeAnimation = require('./animations/fade');
const rotateAnimation = require('./animations/rotate');
const zoomAnimation = require('./animations/zoom');
const slideAnimation = require('./animations/slide');
const bounceAnimation = require('./animations/bounce');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const upload = multer({ dest: 'uploads/' });
const movieDuration = 30;
const user_animation_duration = movieDuration / 2;

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const songs = ['מלאכי השלום', 'ביבי המלך', 'עם ישראל חי', 'התקווה', 'מזרחי טיפוסי', 'שבוע טוב'];
const backgrounds = ['שקיעה', 'חיילים', 'כותל', 'שבת שלום', 'פרחים'];
const animations = ['דעיכה', 'סחרור', 'זום', 'מחליק פנימה', 'אלכסון'];

const animations_converter = {
  'דעיכה': "fade",
  'סחרור': "rotate", 'זום': "zoom", 'מחליק פנימה': "slide", 'אלכסון': "bounce"
}

app.get('/options', (req, res) => {
  console.log('Options endpoint hit');
  res.json({ songs, backgrounds, animations });
});

app.post('/create-video', upload.array('images', 2), (req, res) => {
  const { song, animation, background, text } = req.body;
  const images = req.files;

  if (!images || images.length === 0) {
    console.log('No images uploaded');
    return res.status(400).send('No images uploaded');
  }

  console.log('Received request:', { song, animation, background, imageCount: images.length, text });

  const outputDir = path.join(__dirname, 'public/outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFileName = `output_${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  let command = ffmpeg();

  command = command.input(path.join(__dirname, 'backgrounds', `${background}.jpg`)).loop(movieDuration);

  images.forEach((image) => {
    command = command.input(image.path).loop(user_animation_duration);
  });

  command = command.input(path.join(__dirname, 'songs', `${song}.mp3`));
  command = command.input(path.join(__dirname, 'public', 'test.png')); // Adding the new image

  let filterComplex = [];
  filterComplex.push('[0:v]scale=640:360[bg]');

  images.forEach((_, index) => {
    const animationFilter = getAnimationFilter(animation, index);
    console.log(`Animation filter for image ${index}:`, animationFilter);
    filterComplex.push(`[${index + 1}:v]scale=320:180[img${index}]`);
    filterComplex.push(animationFilter);
  });

  // Handle Hebrew text
  const fontPath = path.join(__dirname, 'public', 'ktav.otf'); // Ensure this path is correct
  const hebrewText = text; // Ensure the text is properly encoded
  const reversedText = hebrewText.split('').reverse().join('');

  let fontsize=70;
  let yoffsetText = 20;
  filterComplex.push(`[bg]drawtext=fontfile=${fontPath}:text='${reversedText}':x='(w-tw)/2 + 30*sin(2*PI*t/5)':y=${yoffsetText}:fontcolor=red:fontsize=${fontsize}:shadowcolor=white:shadowx=3:shadowy=3[bg]`);

  const filterComplexString = filterComplex.join(';');
  console.log('Filter complex:', filterComplexString);

  command.complexFilter(filterComplexString)
    .outputOptions('-map', '[bg]')
    .outputOptions('-map', `${images.length + 1}:a`)
    .outputOptions('-shortest')
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions('-pix_fmt', 'yuv420p')
    .outputOptions('-b:v', '500k') // Set video bitrate to 500k
    .outputOptions('-maxrate', '500k') // Max video bitrate
    .outputOptions('-bufsize', '1000k') // Buffer size
    .outputOptions('-b:a', '64k') // Set audio bitrate to 64k
    .outputOptions('-ac', '1') // Set audio channel to mono
    .fps(15) // Reduce frame rate to 15 fps
    .outputOptions('-preset', 'ultrafast') // Set FFmpeg preset to ultrafast
    .duration(movieDuration)
    .on('start', (commandLine) => {
      console.log('FFmpeg command:', commandLine);
    })
    .on('end', () => {
      console.log('Video processing finished!');
      res.json({ videoUrl: `outputs/${outputFileName}`, status: 'complete' });
      images.forEach(image => fs.unlinkSync(image.path));
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      console.error('FFmpeg error details:', err.message, err.stack);
      res.status(500).json({ error: 'Error creating video', details: err.message });
    })
    .save(outputPath);
});

function getAnimationFilter(animation, index) {
  let segmentDuration = movieDuration;
  switch (animations_converter[animation]) {
    case 'slide':
      return `[bg][img${index}]overlay=x='(W-w)/2 + (W/4) * sin(PI*t/${movieDuration})':y=(H-h)/2:enable='between(t,${index * segmentDuration},${(index + 1) * segmentDuration})'[bg]`;
    case 'bounce':
      return `[bg][img${index}]overlay=x='(W-w)/2 + (W/4) * sin(2*PI*t/${movieDuration})':y='(H-h)/2 + (H/4) * abs(sin(2*PI*t/${movieDuration}))':enable='between(t,${index * segmentDuration},${(index + 1) * segmentDuration})'[bg]`;
    case 'rotate':
      return `[img${index}]rotate='4*PI*t/60':c=none[rotated];
              [bg][rotated]overlay=x='(W-w)/2':y='(H-h)/2'[bg]`;
    case 'fade':
      return `[img${index}]format=rgba,
              fade=in:st=0:d=1:alpha=1,
              fade=out:st=4:d=3:alpha=0[img${index}_faded];
              [img${index}_faded]loop=loop=-1:size=70:start=0[img${index}_looped];
              [bg][img${index}_looped]overlay=x=(W-w)/2:y=(H-h)/2[bg]`;
    case 'zoom':
      return `[img${index}]scale='min(iw*1.5,iw*0.1+(iw*1.4*t/${movieDuration / 3}))':
                    -1:eval=frame[zoomed];
                    [bg][zoomed]overlay=x='(W-w)/2':y='(H-h)/2':
                    enable='between(t,${index * segmentDuration},${(index + 1) * segmentDuration})'[bg]`;
    default:
      return '';
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
