// components/channel/skeletons/ChannelSkeleton.jsx
import './channel-skeleton.scss';

const ChannelSkeleton = ({ count = 8 }) => {
  return (
    <div className="channel-skeleton">
      {/* Header skeleton */}
      <section className="channel-skeleton__header">
        <div className="channel-skeleton__header-inner">
          <div className="skeleton-title skeleton-animate" />
          <div className="skeleton-subtitle skeleton-animate" />
        </div>
      </section>

      {/* Search bar skeleton */}
      <section className="channel-skeleton__toolbar">
        <div className="channel-skeleton__toolbar-inner">
          <div className="skeleton-search skeleton-animate" />
        </div>
      </section>

      {/* Grille skeleton */}
      <section className="channel-skeleton__content">
        <div className="channel-skeleton__grid">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card__thumbnail skeleton-animate" />
              <div className="skeleton-card__body">
                <div className="skeleton-card__category skeleton-animate" />
                <div className="skeleton-card__title skeleton-animate" />
                <div className="skeleton-card__title skeleton-card__title--short skeleton-animate" />
                <div className="skeleton-card__meta skeleton-animate" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ChannelSkeleton;
