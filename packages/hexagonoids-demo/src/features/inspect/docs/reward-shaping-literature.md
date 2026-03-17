# Reward Shaping for Asteroids-like Games: Literature Review

## 1. Atari Asteroids as the Canonical Benchmark

The Atari 2600 Asteroids game has been a standard RL benchmark since the original DQN paper (Mnih et al., 2013). The Gymnasium/ALE environment (`ALE/Asteroids-v5`) uses raw game score delta as the per-step reward:

| Target | Points |
|--------|--------|
| Large asteroid | 20 |
| Medium asteroid | 50 |
| Small asteroid | 100 |
| Large UFO | 200 |
| Small UFO | 1,000 |

A full wave (all fragments from initial asteroids) yields ~2,240 points. This creates an inherent imbalance where UFO hunting is far more lucrative, which RL agents can and do exploit.

**Key observation**: Even in the original Atari game, the reward is inherently sparse. Most frames return 0. Only destruction events produce signal.

### Agent Performance on Asteroids

| Agent | Score | Notes |
|-------|-------|-------|
| Random | ~800 | Baseline |
| Human (median) | ~13,157 | Atari benchmark |
| DQN (2015) | ~1,629 | Below human, credit-assignment difficulty |
| NGU (2020) | ~248,951 | Never Give Up, episodic curiosity |
| Agent57 (2020) | ~150,854 | First superhuman on all 57 games |

Asteroids is "medium difficulty" for RL -- not trivially solvable like Pong, but not a hard-exploration problem like Montezuma's Revenge. The challenge is **credit assignment over long action sequences** (maneuvering + aiming before a kill) rather than exploration.

## 2. DeepMind's Reward Clipping: [-1, 0, +1]

From the Nature DQN paper (Mnih et al., 2015):
- All positive rewards clipped to +1
- All negative rewards clipped to -1
- Zero remains 0

**Rationale**: Score scales vary enormously across Atari games. Clipping allows identical hyperparameters across all 49 games.

**Trade-offs**:
- Pro: Gradient stability, game-agnostic tuning
- Con: Loses magnitude information entirely (a 20-point asteroid = a 1,000-point UFO)
- Con: Not useful for game-specific training like Hexagonoids

**Verdict for Hexagonoids**: Not applicable. We're training a single game and want the agent to distinguish between different-value events. Reward clipping is a multi-game convenience, not a best practice for focused training.

## 3. Reward Scale: The Core Question

### Dense Small vs. Sparse Large

The RL engineering literature strongly favors **dense, moderate rewards** over sparse large ones:

> "Reward values that differ by many orders of magnitude create optimization instability. The gradient from a +200 reward is 200x larger than from +1, causing catastrophic parameter updates." -- RL Bag of Tricks

This is especially relevant for AC/PPO where advantage estimates directly scale gradients:
- A +200 advantage produces 200x the policy gradient of a +1 advantage
- Without careful normalization, this causes massive weight swings
- Hexagonoids with `rockReward=1, deathPenalty=-1` has this exactly right for *scale*, but wrong for *density*

### Normalization Approaches

| Technique | How it works | When to use |
|-----------|-------------|-------------|
| Reward clipping | Clip to [-1, 0, +1] | Multi-game DQN (not us) |
| Reward scaling | Divide by max possible | Known reward bounds |
| Running normalization | Normalize by running mean/var | Unknown/shifting reward scales |
| Advantage normalization | Normalize advantages, not rewards | PPO/A2C (recommended) |
| Return-based scaling | Normalize by return statistics | When reward statistics are non-stationary |

**Recommendation for Hexagonoids**: Use advantage normalization in the AC/QL implementations. Keep rewards in a moderate range (say -10 to +10) and let advantage normalization handle the rest.

## 4. Potential-Based Reward Shaping (PBRS)

### The Fundamental Theorem (Ng, Harada, Russell, 1999)

Define a potential function `Phi(s)` over states. The shaping reward is:

```
F(s, s') = gamma * Phi(s') - Phi(s)
```

**Policy invariance guarantee**: The optimal policy under shaped reward `R + F` is identical to the optimal policy under the original reward `R`. This is both sufficient AND necessary -- any non-potential-based shaping can change the optimal policy.

### Good Potential Functions for Asteroids

| Potential | Formula | Effect |
|-----------|---------|--------|
| Engagement | `-distance_to_nearest_asteroid` | Rewards approaching targets |
| Safety | `+distance_to_nearest_threat` | Rewards avoiding imminent danger |
| Clearance | `count_of_nearby_free_space` | Rewards positioning with escape routes |
| Progress | `-asteroids_remaining / initial_count` | Rewards wave progression |

The beauty of PBRS is you can combine multiple potentials and the guarantee still holds.

### Practical Considerations

- PBRS adds dense signal (every tick gets a shaped reward) without changing the optimal policy
- The potential function must be computable from observable state
- Choosing the right potential remains an open challenge (2024-2025 papers)
- For Asteroids, combining engagement + safety potentials mirrors the actual game tension: approach danger to score

**Verdict for Hexagonoids**: PBRS is the theoretically safest way to add dense reward signal. The spatial data (asteroid positions, distances) is already available in the observation encoding. This is the strongest recommendation from the literature.

## 5. Intrinsic Motivation / Curiosity

### Intrinsic Curiosity Module (Pathak et al., 2017)

Curiosity = prediction error in a learned feature space. A forward model predicts next state features; large prediction errors (surprising states) earn bonus reward.

Results: 880% expert human performance on Atari averaged, 10x learning speedup on navigation.

### Never Give Up / Agent57 (DeepMind, 2020)

Uses episodic memory to detect novel states within an episode. An adaptive meta-controller balances exploration vs exploitation.

**Applicability to Hexagonoids**: Asteroids has constantly changing state (moving/splitting asteroids), which provides rich prediction-error signal. However, pure curiosity can lead to the "TV static" problem where unpredictable elements are endlessly fascinating but useless. Best used as a **supplement** to extrinsic reward.

**Verdict for Hexagonoids**: Too complex for the current architecture. The neat-js RL plugins operate on rollout segments with fixed-topology networks. Curiosity modules require separate learned models. File this for future work.

## 6. Curriculum Learning + Reward Shaping

Khan et al. (2025) showed that combining curriculum learning with reward shaping significantly improved RL performance in first-person shooter games (Doom):

- Start with simple scenarios (few, large, slow targets)
- Gradually increase difficulty as the agent improves
- Shape rewards to guide early learning, reduce shaping as curriculum advances

**Hexagonoids already does this** -- the scenario system and curriculum system provide exactly this capability. The missing piece is connecting curriculum progression to reward shaping intensity.

## 7. Multi-Component Reward Functions

### From NERO (Stanley et al., 2005)

The NERO game (real-time neuroevolution for game agents) used weighted multi-component fitness:

```
F = w1*f1 + w2*f2 + ... + wn*fn
```

Components: distance to enemies, accuracy, survival, territory control. The innovation was allowing **dynamic weight adjustment** during training -- effectively manual curriculum learning.

### Standard Components for Asteroids Agents

| Component | Role | Typical Weight |
|-----------|------|---------------|
| Kills | Primary objective | High (60-80%) |
| Survival | Stay alive to score more | Medium (10-20%) |
| Accuracy | Resource conservation | Low (5-15%) |
| Engagement | Approach threats, don't hide | Low (5-10%) |

### Action-Guidance (Bester et al., 2020)

A hybrid approach: train with shaped/dense rewards but **evaluate and select on the true sparse objective**. Gets the sample efficiency benefits of shaping without the policy-distortion risk.

**This is exactly what Hexagonoids can do**: NEAT fitness (the selection signal) is the true objective; RL rewards (the training signal) can be densely shaped without risk, because NEAT selection still uses the unshaped fitness function.

## 8. Common Pitfalls

### Reward Hacking
- An agent rewarded for survival learns to hide in corners
- An agent rewarded per-kill becomes suicidally aggressive (kamikaze rushing)
- An agent rewarded for shots-fired learns to spray continuously

### Reward Scale Instability
- Large rewards (e.g., +200) create huge advantage estimates
- These produce massive policy gradient updates
- Network weights swing wildly, destabilizing the entire population
- **This is exactly the mass extinction problem reported in Hexagonoids**

### The Sparsity-Scale Tradeoff
- Increasing reward magnitude compensates for sparsity (larger signal cuts through noise)
- But large magnitudes cause optimization instability
- The solution is to **increase density, not magnitude**

### Mitigation Strategies
1. **Advantage normalization**: Normalize advantages before computing gradients
2. **Gradient clipping**: Cap the magnitude of parameter updates
3. **PBRS**: Add dense signal without changing optimal policy
4. **Separate training and selection signals**: Shape RL rewards freely; use unshaped fitness for NEAT selection

## Key References

1. Mnih et al. (2013). "Playing Atari with Deep Reinforcement Learning." arXiv:1312.5602
2. Mnih et al. (2015). "Human-level control through deep reinforcement learning." Nature 518.
3. Ng, Harada, Russell (1999). "Policy Invariance Under Reward Transformations." ICML.
4. Pathak et al. (2017). "Curiosity-driven Exploration by Self-supervised Prediction." arXiv:1705.05363
5. Badia et al. (2020). "Agent57: Outperforming the Human Atari Benchmark." DeepMind.
6. Bester et al. (2020). "Action Guidance: Getting the Best of Sparse Rewards and Shaped Rewards." arXiv:2010.03956
7. Stanley et al. (2005). "Real-Time Neuroevolution in the NERO Video Game." IEEE TEC.
8. Khan et al. (2025). "Optimizing Curriculum Learning and Reward Shaping in Games." Wiley.
9. Hsu et al. (2021). "Return-based Scaling: Yet Another Normalisation Trick for Deep RL." arXiv:2105.05347
10. Burda et al. (2018). "Large-Scale Study of Curiosity-Driven Learning." NeurIPS.
