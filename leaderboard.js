import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAWff6Rz_J3tGWjSjn0rE3HCBzuQkVSiBA',
  authDomain: 'jelly-runner-d72e7.firebaseapp.com',
  projectId: 'jelly-runner-d72e7',
  storageBucket: 'jelly-runner-d72e7.firebasestorage.app',
  messagingSenderId: '431234560596',
  appId: '1:431234560596:web:94130e7f1b7d2561e473c1'
};

const db = getFirestore(initializeApp(firebaseConfig));
const scores = collection(db, 'scores');
const modal = document.getElementById('scoreModal');
const form = document.getElementById('scoreForm');
const nickname = document.getElementById('nickname');
const status = document.getElementById('scoreStatus');
const rankingView = document.getElementById('rankingView');
const rankingBody = document.getElementById('rankingBody');
const rankingStatus = document.getElementById('rankingStatus');
let run = null;

try { nickname.value = localStorage.getItem('jellyrun-nickname') || ''; } catch {}

function cleanNickname(value) {
  return value.trim().replace(/\s+/g, ' ').replace(/[<>]/g, '').slice(0, 12);
}

function compareScores(a, b) {
  return b.score - a.score || b.distance - a.distance || a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function row(entry, rank, isMe, outsideTop = false) {
  const tr = document.createElement('tr');
  if (isMe) tr.classList.add('is-me');
  if (outsideTop) tr.classList.add('outside-top');
  const values = [rank, entry.nickname, entry.score.toLocaleString('ko-KR'), `${entry.distance.toLocaleString('ko-KR')} m`, formatDate(entry.createdAtMs)];
  values.forEach((value, index) => {
    const td = document.createElement('td');
    td.textContent = value;
    if (index === 0 && rank <= 3) td.className = 'rank-medal';
    tr.appendChild(td);
  });
  return tr;
}

async function showRanking(currentId) {
  rankingBody.replaceChildren();
  rankingStatus.textContent = '순위를 불러오는 중…';
  const snapshot = await getDocs(scores);
  const entries = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      nickname: String(data.nickname || '익명').slice(0, 12),
      score: Math.max(0, Number(data.score) || 0),
      distance: Math.max(0, Number(data.distance) || 0),
      createdAtMs: Number(data.createdAtMs) || data.createdAt?.toMillis?.() || Date.now()
    };
  }).sort(compareScores);
  const top = entries.slice(0, 10);
  top.forEach((entry, index) => rankingBody.appendChild(row(entry, index + 1, entry.id === currentId)));
  const myIndex = entries.findIndex(entry => entry.id === currentId);
  if (myIndex >= 10) rankingBody.appendChild(row(entries[myIndex], myIndex + 1, true, true));
  if (!entries.length) {
    const empty = document.createElement('tr');
    empty.innerHTML = '<td class="empty" colspan="5">아직 등록된 기록이 없습니다.</td>';
    rankingBody.appendChild(empty);
  }
  rankingStatus.textContent = myIndex >= 0 ? `내 순위는 ${myIndex + 1}위입니다.` : 'TOP 10 기록입니다.';
}

window.addEventListener('jellyrun:finished', event => {
  run = event.detail;
  document.getElementById('finalScore').textContent = run.score.toLocaleString('ko-KR');
  document.getElementById('finalDistance').textContent = `${run.distance.toLocaleString('ko-KR')} m · ${run.time}`;
  form.hidden = false;
  rankingView.hidden = true;
  status.textContent = '닉네임을 입력하면 기록이 순위표에 저장됩니다.';
  status.classList.remove('error');
  modal.hidden = false;
  setTimeout(() => nickname.focus(), 50);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const name = cleanNickname(nickname.value);
  if (name.length < 2) {
    status.textContent = '닉네임을 2자 이상 입력해 주세요.';
    status.classList.add('error');
    nickname.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  nickname.disabled = true;
  status.classList.remove('error');
  status.textContent = '기록을 저장하는 중…';
  try {
    const createdAtMs = Date.now();
    const saved = await addDoc(scores, { nickname: name, score: run.score, distance: run.distance, playSeconds: run.seconds, createdAt: serverTimestamp(), createdAtMs });
    try { localStorage.setItem('jellyrun-nickname', name); } catch {}
    form.hidden = true;
    rankingView.hidden = false;
    await showRanking(saved.id);
  } catch (error) {
    console.error('Leaderboard save failed', error);
    status.textContent = '기록을 저장하지 못했습니다. Firebase 설정과 네트워크를 확인한 뒤 다시 시도해 주세요.';
    status.classList.add('error');
  } finally {
    button.disabled = false;
    nickname.disabled = false;
  }
});

document.getElementById('runAgain').addEventListener('click', () => {
  modal.hidden = true;
  window.dispatchEvent(new CustomEvent('jellyrun:restart'));
});

