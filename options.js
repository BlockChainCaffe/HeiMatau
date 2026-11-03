const t = document.getElementById('d');
const m = document.getElementById('m');

chrome.storage.local.get({ domains: [] }, ({ domains }) => {
  t.value = domains.join('\n');
});

document.getElementById('s').onclick = () => {
  const domains = t.value.split('\n').map(s => s.trim()).filter(Boolean);
  chrome.storage.local.set({ domains }, () => {
    m.textContent = 'Salvato ✓';
    setTimeout(() => (m.textContent = ''), 1500);
  });
};
