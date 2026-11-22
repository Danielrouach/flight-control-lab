# Numerical model provenance and assumptions

**Source priority:** original Guidance homework assignment PDF; completed Elbit Guidance and Control solution; `part1_autopilot.m` and `part2_guidance.m` for the executable behavior. The source PDFs and personal report are not committed to this public repository.

## Model 1 — linearized short-period longitudinal autopilot

The original nonlinear derivation includes Earth/body rotations and gravity. The executable browser model is the **incremental, trimmed** constant-speed model, not a nonlinear 6DOF solver. The provided sources do not fully specify thrust, axial forces, trim baseline force coefficients, or the geometry needed for a valid nonlinear reconstruction.

```
x = [alpha, q, delta]^T
x_dot = A*x + B*delta_command_applied
az = C*x
alpha_dot = q + Za/(m*V0)*alpha + Zd/(m*V0)*delta
q_dot     = Ma/Iyy*alpha + Mq/Iyy*q + Md/Iyy*delta
delta_dot = (delta_command_applied-delta)/tau_delta
```

The body +Z axis points **down**. Specific force measured by the IMU is `az=Za/m*alpha+Zd/m*delta`, not `w_dot`. The corrected linearization includes **`+q`** in `alpha_dot`, per the report and the revised MATLAB code.

The physical model constants are `V0=100 m/s`, `rho=1.225 kg/m³`, `m=42.48 kg`, `Iyy=12.87 kg m²`, `Cref=.327 m`, `Sref=.9765 m²`, `tau_delta=.015 s`, `deltaMax=10°` and coefficients `CZa=-5.88`, `CZd=-.566`, `CMa=-.45`, `CMd=-1.716`, `CMq=-27.51`.

```
Za = qbar*Sref*CZa             = -35168.6475
Zd = qbar*Sref*CZd             = -3385.281375
Ma = qbar*Sref*Cref*CMa        = -880.113346875
Md = qbar*Sref*Cref*CMd        = -3356.16556275
Mq = qbar*Sref*Cref²*CMq/(2V0) = -87.969969...

A ~= [[ -8.2789,   1.0000,   -0.7969 ],
      [-68.3849,  -6.8353, -260.7743 ],
      [  0,        0,       -66.6667 ]]
B = [0,0,66.6667]^T
C = [-827.8872,0,-79.6912]
D = 0   (the actuator-augmented plant is strictly proper)
Co = [C; 0 1 0]
```

Similarity transform: `z=T*x=[az,q,delta]`, `T=[C;0 1 0;0 0 1]`. It is invertible since Za != 0.

Nominal pole placement on `[x,xi]` uses poles `[-14,-20,-55,-70]`. MATLAB design in the **original** coordinates:

```
K  = [-5.67842131, -0.35587421, 1.15828782]
ki = -0.07683826
L  = [[-0.10170966,    0.63636967],
      [-1.44366241,  182.04771800],
      [-0.00023360,   -0.00322980]]
```

L is a continuous-time LQE gain with supplied sensor standard deviations `0.01 m/s²` and `0.03 deg/s`, and **assumed** process covariance `diag(1e-6,1e-2,1e-7)`. Nominal time plots have no simulated sensor noise. Use `y=Co*x`.

```
commandKnown  = sat(-K*xhat-ki*xi, ±10°)
commandActual = sat(commandKnown+disturbance(t), ±10°)
xhat_dot      = A*xhat+B*commandKnown+L*(Co*x-Co*xhat)
xi_dot        = reference-az
```

MATLAB reference scenario: `reference=1 m/s²`, initial 7 states zero, `tMax=1.5 s`, `ode45 RelTol=1e-8, AbsTol=1e-9`. Disturbance is a separate `+0.005 rad` actuator-command step after `t=.5 s` with reference zero. Browser implements both at the same time when the user enables a disturbance.

The **open-loop** website mode applies a constant actuator deflection command. The **full-state** feedback mode is a clearly labeled theoretical extension using the documented `K` plus a DC prefilter `Nr=-1/[C(A-BK)^-1 B]`; it assumes instantaneous full-state sensing. The default observer+integrator mode reproduces MATLAB. When the actuator time constant changes, nominal K/L are held fixed; this represents a robustness experiment, **not a newly optimized design**. No anti-windup is added beyond MATLAB's saturation.

Visualization `theta(t)=∫q(t)dt`, `theta0=0`; vehicle pitch/deflection geometric rotations are explicitly magnified **40x/180x** for visibility, with real numerical values displayed unmodified.

## Model 2 — planar proportional navigation

Default initial conditions: interceptor `[xM,hM,gamma]=(0,1000,0)`, target `[xT,hT]=(1000,0)`; constant interceptor/target speeds `50/30 m/s`. The target is nonmaneuvering. Positive `h`, `gamma` and normal acceleration are **upward**, unlike Part 1's body-down specific acceleration.

```
rx = xT0 + vT*t - xM; rh = hT0-hM
R = hypot(rx,rh); lambda = atan2(rh,rx)
vrx = vT - vM*cos(gamma); vrh = -vM*sin(gamma)
lambda_dot = (rx*vrh-rh*vrx)/R²
Vc = -(rx*vrx+rh*vrh)/R
aPN = N*max(Vc,0)*lambda_dot
ac = sat(aPN+g*cos(gamma), -aLimit, +aLimit)
xM_dot=vM*cos(gamma)
hM_dot=vM*sin(gamma)
gamma_dot=(aActual-g*cos(gamma))/vM
ideal: aActual=ac
lagged: aActual_dot=(ac-aActual)/tauA
```

`g=9.81`, `N=3`, `aLimit=2g=19.62 m/s²`, `tauA=.15s` **assumed by solution**, `hitRadius=5m` **assumed by solution**, `tMax=100s`. Lagged acceleration is initially `g*cos(gamma0)` (trim-consistent). Relative separation is evaluated at the exact integration time, and the first incoming crossing of `R=5 m` is solved via step-local bisection. This is **within-radius interception**, not an exact impact at zero range. Speed is assumed constant without specifying a separate tangential thrust/drag model.

**Documented source differences:** the report's displayed mathematical PN expression is `N*Vc*lambdaDot`; the executable MATLAB implementation has a `max(Vc,0)` guard, retained here to avoid reversing the guidance law for receding targets. The original assignment sketch depicts the acceleration direction differently; the finished report and MATLAB choose positive-up normal acceleration. The two conventions are labeled rather than silently mixed.

## Numerical solver and reproducibility

MATLAB uses adaptive `ode45` (Dormand–Prince 4/5), `RelTol=1e-8`, `AbsTol=1e-9`. The browser uses fourth-order fixed-step Runge–Kutta: default `dt=0.001 s` (Part 1), `dt=0.02 s` (Part 2), and higher resolution in the validation view. This deterministic difference is acceptable at the reported tolerances and is explicitly covered by automated comparison tests. Animation only reads precomputed solver trajectories; browser frame rate **cannot alter** physical simulation time steps.

For the exact MATLAB baseline, the browser references: Part 1 rise 0.2050s, settling 0.3936s, final az 1m/s²; gain margin 11.2117dB, phase margin 51.9373°, delay margin .02651s, reference bandwidth 10.7412rad/s. Frequency values remain MATLAB-only references; browser calculations do not imply a loop-break convention or reproduce Bode/Nichols margins. Guidance ideal 61.899028s; lagged 61.968170s; both at R=5m. The numeric tests compare time-event behavior and physical limits, and reject invalid inputs.

## Non-goals of the present version

No physical target maneuver model, no Monte Carlo sensor noise, no 6DOF flight model, no actuator torque limits beyond deflection, no implicit coupling between 100 m/s Part 1 and 50 m/s Part 2, and no claim of mathematically exact target impact. A real full-system coupling requires a justified common operating point, sign convention conversion, initialization, actuator/control interface, and further numerical validation.
