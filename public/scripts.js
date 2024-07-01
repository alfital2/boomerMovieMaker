document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('videoForm');
  const resultDiv = document.getElementById('result');
  const downloadLink = document.getElementById('downloadLink');
  const loadingDiv = document.getElementById('loading');
  const fileInput = document.getElementById('images');
  const fileChosen = document.getElementById('file-chosen');

  const textInput = document.getElementById('text');
  const textValidation = document.getElementById('text-validation');

  const backendURL = "https://boomermoviemaker-backend.onrender.com";
  //const backendURL = "http://localhost:3000";

  textInput.addEventListener('input', () => {
    const value = textInput.value;
    const hebrewRegex = /^[\u0590-\u05FF\s0-9!@#$%^&*,'()_+-=]*$/;

    if (value.length > 30 || !hebrewRegex.test(value)) {
      textValidation.style.display = 'block';
    } else {
      textValidation.style.display = 'none';
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileChosen.textContent = Array.from(fileInput.files).map(file => file.name).join(', ');
    } else {
      fileChosen.textContent = 'לא נבחרו קבצים';
    }
  });

  resultDiv.style.display = 'none';
  loadingDiv.style.display = 'none';

  fetch(`${backendURL}/options`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Options fetched:', data);
      populateSelect('song', data.songs);
      populateSelect('animation', data.animations);
      populateSelect('background', data.backgrounds);
    })
    .catch(error => {
      console.error('Error fetching options:', error);
      alert('Failed to load options. Please refresh the page.');
    });

 form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('trying to submit');

    if (fileInput.files.length === 0) {
      alert('נא לבחור תמונה');
      return;
    }

    if (textValidation.style.display === 'block') {
      alert('נא לתקן את הטעויות בטקסט לפני שליחת הטופס.');
      return;
    }
    resultDiv.style.display = 'none';
    loadingDiv.style.display = 'block'; // Show loading message

    const formData = new FormData(form);

    try {
      console.log('Sending request to create video...');
      const response = await fetch(`${backendURL}/create-video`, {
        method: 'POST',
        body: formData
      });

      console.log('Request sent, awaiting response...');

      if (!response.ok) {
        throw new Error('Server response was not ok');
      }

      const result = await response.json();
      console.log('Server response:', result);

     if (result.status === 'complete') {
  console.log('Video created:', result);
  downloadLink.href = `${backendURL}${result.videoUrl}`;
  resultDiv.style.display = 'block';
  console.log('Result displayed');
} else {
        throw new Error('Video processing incomplete');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      if (error.response) {
        console.error('Server responded with:', await error.response.text());
      }
      alert('An error occurred while creating the video: ' + error.message);
    } finally {
      loadingDiv.style.display = 'none'; // Hide loading message
    }
  });

 downloadLink.addEventListener('click', (e) => {
  e.preventDefault();
  downloadVideo(downloadLink.href);
});

 function downloadVideo(url) {
  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = 'boomer_movie.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download failed:', error);
      alert('Failed to download the video. Please try again.');
    });
}

  function populateSelect(id, options) {
    const select = document.getElementById(id);
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value || option;
      optionElement.textContent = option.name || option;
      select.appendChild(optionElement);
    });
  }
});
