const fs = require('fs');
const path = require('path');

const files = [
  'admin/dashboard/dashboard.css',
  'admin/voters/voters.css',
  'admin/parties/parties.css',
  'admin/register-voter/register-voter.css',
  'admin/register-party/register-party.css',
  'party-dashboard/p-parties.css',
  'party-dashboard/p-result.css',
  'voter-dashboard/v-dashboard.css',
  'voter-dashboard/v-result.css',
  'voter-dashboard/v-vote.css'
];

const stdMedia = `
/* Global Mobile Responsiveness */
@media screen and (max-width: 768px) {
  .top-header { flex-direction: column; text-align: center; gap: 15px; padding: 15px 5%; }
  .tab-nav { flex-wrap: wrap; gap: 10px; justify-content: center; overflow: visible; }
  .tab { width: 45%; text-align: center; }
  .container { padding: 0 10px; }
  
  /* Flexbox cards collapsing */
  .stat-card, .vstat-card { flex-direction: column; text-align: center; gap: 10px; padding: 15px; }
  .list-item { flex-direction: column; text-align: center; gap: 10px; }
  
  /* Form scaling */
  .form-grid { display: flex !important; flex-direction: column !important; }
  .button-group { flex-direction: column; }
  .card { padding: 20px; }
  
  /* Video/Popup Scaling */
  .face-modal { max-width: 90%; padding: 15px; }
  video { width: 100% !important; height: auto !important; }
}
`;

files.forEach(f => {
  const p = path.join('c:/Users/ankit/OneDrive/Documents/HTML/voting-system/client', f);
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    if (!c.includes('/* Global Mobile Responsiveness */')) {
      fs.writeFileSync(p, c + stdMedia);
      console.log('Injected:', f);
    } else {
      console.log('Already injected:', f);
    }
  } else {
    console.log('File not found:', p);
  }
});
