<script lang="ts">
  let { state = 'off', label = '', size = 'medium' } = $props<{
    state?: 'on' | 'off' | 'downloading';
    label?: string;
    size?: 'small' | 'medium' | 'large';
  }>();
</script>

<div class="status-indicator state-{state} size-{size}">
  <div class="indicator-dot"></div>
  {#if label}
    <span class="indicator-label">{label}</span>
  {/if}
</div>

<style>
  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: inherit;
  }

  .indicator-dot {
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  /* Sizes */
  .size-small .indicator-dot {
    width: 8px;
    height: 8px;
  }
  .size-small .indicator-label {
    font-size: 11px;
  }

  .size-medium .indicator-dot {
    width: 10px;
    height: 10px;
  }
  .size-medium .indicator-label {
    font-size: 13px;
  }

  .size-large .indicator-dot {
    width: 14px;
    height: 14px;
  }
  .size-large .indicator-label {
    font-size: 15px;
  }

  /* States */
  .state-on .indicator-dot {
    background: #10b981;
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.4),
      0 0 8px rgba(16, 185, 129, 0.5);
  }
  .state-on .indicator-label {
    color: #10b981;
  }

  .state-off .indicator-dot {
    background: #64748b;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1);
  }
  .state-off .indicator-label {
    color: #94a3b8;
  }

  .state-downloading .indicator-dot {
    background: #3b82f6;
    animation: pulse 1.5s infinite;
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.4),
      0 0 8px rgba(59, 130, 246, 0.5);
  }
  .state-downloading .indicator-label {
    color: #3b82f6;
    animation: pulse-text 1.5s infinite;
  }

  .indicator-label {
    font-weight: 500;
    letter-spacing: 0.2px;
  }

  @keyframes pulse {
    0% {
      opacity: 0.5;
      transform: scale(0.9);
      box-shadow: 0 0 0 rgba(59, 130, 246, 0);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
    }
    100% {
      opacity: 0.5;
      transform: scale(0.9);
      box-shadow: 0 0 0 rgba(59, 130, 246, 0);
    }
  }

  @keyframes pulse-text {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }
</style>
