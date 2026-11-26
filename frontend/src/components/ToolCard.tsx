import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudioTool } from '../lib/tools';
import { loadFavourites, toggleFavourite } from '../lib/guestProjects';

export default function ToolCard({ tool }: { tool: StudioTool }) {
  const [favs, setFavs] = useState<string[]>(() => loadFavourites());
  const isFav = favs.includes(tool.id);
  const onStar = () => setFavs(toggleFavourite(tool.id));

  return (
    <article className="card tool-card">
      <div className="tool-ico" aria-hidden="true">{tool.icon}</div>
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
      <div className="tool-meta">
        <span className="tag">{tool.category}</span>
        <span className={`status ${tool.status === 'live' ? 'status-live' : 'status-setup'}`}>{tool.statusLabel}</span>
      </div>
      <div className="tool-actions">
        {tool.external ? (
          <Link className="btn btn-sm" to={tool.route}>Open Tool →</Link>
        ) : (
          <Link className="btn btn-sm" to={tool.route}>Open Tool →</Link>
        )}
        <button
          className={`star-btn${isFav ? ' fav' : ''}`}
          type="button"
          onClick={onStar}
          aria-label={isFav ? `Remove ${tool.name} from favourites` : `Save ${tool.name} as favourite`}
          title={isFav ? 'Favourited' : 'Add to favourites'}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
    </article>
  );
}
