export const useDesignTokens = () => ({
  transitions: {
    durations: {
      fast: 200,
      normal: 300,
      slow: 500,
      page: 600,
    },
    delays: {
      stagger1: 100,
      stagger2: 150,
      stagger3: 200,
      stagger4: 300,
      stagger5: 500,
    },
  },
  gradients: {
    card: "bg-gradient-to-br from-muted/50 to-muted/30",
    cardHover: "hover:from-muted/70 hover:to-muted/50",
    separator: "bg-gradient-to-b from-transparent via-border to-transparent",
  },
  animations: {
    fadeInUp: "animate-in fade-in slide-in-from-bottom-2",
    scaleOnHover: "hover:scale-105 transition-transform duration-300",
    shadowProgression: "shadow-sm hover:shadow-md",
  },
});
