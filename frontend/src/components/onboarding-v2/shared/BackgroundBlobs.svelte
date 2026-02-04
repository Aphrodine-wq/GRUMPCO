<div class="bg-decoration">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
</div>

<style>
  /* Background decoration */
  .bg-decoration {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(72px);
    opacity: 0.5;
  }

  .blob-1 {
    width: 520px;
    height: 520px;
    background: #7c3aed;
    top: -140px;
    right: -100px;
    animation: blobFloat1 8s ease-in-out infinite;
  }

  .blob-2 {
    width: 440px;
    height: 440px;
    background: #a855f7;
    bottom: -120px;
    left: -100px;
    animation: blobFloat2 10s ease-in-out infinite;
  }

  .blob-3 {
    width: 320px;
    height: 320px;
    background: #6d28d9;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: blobFloat3 12s ease-in-out infinite;
  }

  @keyframes blobFloat1 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(-20px, 20px) scale(1.1);
    }
  }

  @keyframes blobFloat2 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(30px, -20px) scale(1.15);
    }
  }

  @keyframes blobFloat3 {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.3;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .blob {
      animation: none;
    }
  }
</style>
