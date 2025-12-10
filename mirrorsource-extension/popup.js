document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure service worker is ready
  setTimeout(loadStats, 100);
  
  document.getElementById('share-btn').addEventListener('click', shareStats);
  document.getElementById('reset-btn').addEventListener('click', resetStats);
});

function loadStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
    if (chrome.runtime.lastError) {
      console.log('MirrorSource popup: Error loading stats', chrome.runtime.lastError.message);
      document.getElementById('stories').textContent = '0';
      document.getElementById('outlets').textContent = '0';
      return;
    }
    
    if (stats) {
      console.log('MirrorSource popup: Got stats', stats);
      document.getElementById('stories').textContent = stats.monthlyStories || 0;
      document.getElementById('outlets').textContent = Object.keys(stats.domains || {}).length;
    }
  });
}

function shareStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
    const stories = stats?.monthlyStories || 0;
    const outlets = Object.keys(stats?.domains || {}).length;
    
    let text;
    if (stories === 0) {
      text = "I use MirrorSource to see news from multiple perspectives. 🌐 mirrorsource.app";
    } else {
      text = `${stories} stories explored from ${outlets} outlets this month with MirrorSource. 🌐 mirrorsource.app`;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share stats'; }, 1500);
    });
  });
}

function resetStats() {
  if (confirm('Reset all stats?')) {
    chrome.runtime.sendMessage({ action: 'resetStats' }, () => {
      loadStats();
    });
  }
}
