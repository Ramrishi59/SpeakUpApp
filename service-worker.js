const CACHE_NAME = 'speakupapp-cache-v4';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './Images/icon.png',
  './old-index.html',
  './old-script.js',
  './old-style.css',

  // Unit JSON
  './units/unit2.json',

  // ✅ Updated image/audio paths with underscores
  './Images/a_book.png',
  './Audio/a_book.mp3',
  './Images/a_pencil.png',
  './Audio/a_pencil.mp3',
  './Images/a_pen.png',
  './Audio/a_pen.mp3',
  './Images/a_crayon.png',
  './Audio/a_crayon.mp3',
  './Images/a_ruler.png',
  './Audio/a_ruler.mp3',
  './Images/a_bag.png',
  './Audio/a_bag.mp3',
  './Images/a_table.png',
  './Audio/a_table.mp3',
  './Images/a_chair.png',
  './Audio/a_chair.mp3',
  './Images/an_apple.png',
  './Audio/an_apple.mp3',
  './Images/an_orange.png',
  './Audio/an_orange.mp3',
  './Images/an_egg.png',
  './Audio/an_egg.mp3',
  './Images/an_eraser.png',
  './Audio/an_eraser.mp3',
  './Images/an_elephant.png',
  './Audio/an_elephant.mp3',

  // Encouragement Audios
  './Audio/great_job.mp3',
  './Audio/excellent.mp3',
  './Audio/you_got_it.mp3',
  './Audio/chime.mp3',

  // Arrows and Icons
  './Images/arrow_left.png',
  './Images/arrow_right.png',
  './Images/star.png',
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
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (!cacheWhitelist.includes(name)) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});
