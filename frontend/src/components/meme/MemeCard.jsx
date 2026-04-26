import React, { useState } from 'react';
import { ArrowBigUp, ArrowBigDown, Share2 } from 'lucide-react';

const MemeCard = ({ meme }) => {
  const [loaded, setLoaded] = useState(false);
  const [upvotes, setUpvotes] = useState(meme.ups);
  const [voteStatus, setVoteStatus] = useState(0); // 1 for up, -1 for down, 0 for none

  const handleUpvote = () => {
    if (voteStatus === 1) {
      setUpvotes(prev => prev - 1);
      setVoteStatus(0);
    } else {
      setUpvotes(prev => prev + (voteStatus === -1 ? 2 : 1));
      setVoteStatus(1);
    }
  };

  const handleDownvote = () => {
    if (voteStatus === -1) {
      setVoteStatus(0);
    } else {
      if (voteStatus === 1) setUpvotes(prev => prev - 1);
      setVoteStatus(-1);
    }
  };

  return (
    <div className="bg-bgTertiary border border-borderBase rounded-md overflow-hidden hover:bg-bgElevated hover:border-[rgba(255,255,255,0.09)] hover:-translate-y-[2px] transition-all duration-150 ease-in-out mb-6 break-inside-avoid shadow-none">
      <div className="w-full relative min-h-[200px] bg-bgSecondary">
        {!loaded && <div className="absolute inset-0 skeleton" />}
        <img 
          src={meme.url} 
          alt={meme.title}
          className={`w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      </div>
      
      <div className="p-4">
        <h3 className="text-textSecondary text-[0.875rem] leading-snug line-clamp-2 mb-4">
          {meme.title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 bg-bgSecondary rounded-full px-2 py-1 border border-borderBase">
            <button 
              onClick={handleUpvote}
              className={`p-1 rounded-full transition-colors ${voteStatus === 1 ? 'text-accent' : 'text-textMuted hover:text-textPrimary hover:bg-bgElevated'}`}
            >
              <ArrowBigUp size={18} />
            </button>
            <span className={`text-xs font-mono px-1 ${voteStatus === 1 ? 'text-accent' : 'text-textSecondary'}`}>
              {upvotes >= 1000 ? (upvotes / 1000).toFixed(1) + 'k' : upvotes}
            </span>
            <button 
              onClick={handleDownvote}
              className={`p-1 rounded-full transition-colors ${voteStatus === -1 ? 'text-error' : 'text-textMuted hover:text-textPrimary hover:bg-bgElevated'}`}
            >
              <ArrowBigDown size={18} />
            </button>
          </div>
          
          <button className="text-textMuted hover:text-textPrimary p-2 rounded-full hover:bg-bgElevated transition-colors">
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemeCard;
