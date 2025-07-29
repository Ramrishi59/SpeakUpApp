const CACHE_NAME = 'speakupapp-cache-v1'; // You can increment this version if you change cached assets often (e.g., v2, v3)
const urlsToCache = [
  './', // Caches the root of the app (index.html is included by this)
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './Images/icon.png', // Corrected to single icon.png
  './old-index.html',
  './old-script.js',
  './old-style.css',

  // All 13 words, images, and audios (ensure these paths are EXACT!)
  './Images/a book.png',
  './Audio/a book.mp3',
  './Images/a pencil.png',
  './Audio/a pencil.mp3',
  './Images/a pen.png',
  './Audio/a pen.mp3',
  './Images/a crayon.png',
  './Audio/a crayon.mp3',
  './Images/a ruler.png',
  './Audio/a ruler.mp3',
  './Images/a bag.png',
  './Audio/a bag.mp3',
  './Images/a table.png',
  './Audio/a table.mp3',
  './Images/a chair.png',
  './Audio/a chair.mp3',
  './Images/an apple.png',
  './Audio/an apple.mp3',
  './Images/an orange.png',
  './Audio/an orange.mp3',
  './Images/an egg.png',
  './Audio/an egg.mp3',
  './Images/an eraser.png',
  './Audio/an eraser.mp3',
  './Images/an elephant.png',
  './Audio/an elephant.mp3',

  // Encouragement Audios (if you have these files)
  './Audio/great_job.mp3',
  './Audio/excellent.mp3',
  './Audio/you_got_it.mp3',
  './Audio/chime.mp3',

  // Navigation Arrows (if you have these files)
  './Images/arrow_left.png',
  './Images/arrow_right.png',

  // Star Icon (if you have this file)
  './Images/star.png',
    // Manku Image
  './Images/m.png'

];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});