---
name: lunar-math
description: Pure mathematical, physical, and astrodynamical calculations for lunar south pole exploration. Includes coordinate systems, polar stereographic projection, grid convergence, lunar curvature, horizon raycasting, solar disc illumination, solar array power output, Direct-to-Earth (DTE) geometric visibility, path loss, and rover traverse costs.
---

# Lunar Math Skill: RegolithForge Mathematical Foundations

This skill specifies the exact mathematical models, coordinate conventions, and verification benchmarks required for lunar south polar navigation in RegolithForge.

---

## 1. Physical Constants and Parameters

| Parameter | Symbol | Value | Unit | Description / Source |
|---|---|---|---|---|
| Lunar Mean Radius | $R_{\text{moon}}$ | $1,737,400.0$ | $\text{m}$ | IAU/IAG Moon reference sphere |
| Standard Solar Constant | $S_0$ | $1,361.0$ | $\text{W/m}^2$ | Solar constant at 1 AU |
| Astronomical Unit | $1\text{ AU}$ | $149,597,870,700$ | $\text{m}$ | Distance conversion |
| Speed of Light | $c$ | $299,792,458$ | $\text{m/s}$ | Vacuum speed of light |
| Sun Mean Angular Diameter | $\theta_{\text{diam},\odot}$ | $0.533^\circ \approx 32.0'$ | $\text{deg}$ | Solar angular diameter at 1 AU |
| Sun Angular Radius | $\theta_{\text{radius},\odot}$ | $0.2665^\circ \approx 16.0'$ | $\text{deg}$ | Half-angle of solar disc |
| Earth Mean Angular Diameter | $\theta_{\text{diam},\oplus}$ | $\approx 1.90^\circ$ | $\text{deg}$ | Subtended angle of Earth from Moon |
| Lunar Synodic Month | $T_{\text{synodic}}$ | $29.53059$ | $\text{days}$ | Phase cycle period |

---

## 2. Coordinate Frames and Transformations

### 2.1 Topocentric Horizon Frame (Lander Local)
- **Origin**: Lander position at surface elevation $h_{\text{terrain}}$ or mast height $h_{\text{obs}} = h_{\text{terrain}} + h_{\text{mast}}$.
- **Axes**:
  - $+X$ = Local **East**
  - $-Z$ = Local **North** (tangent to local meridian pointing toward North pole)
  - $+Y$ = Local **Up** (Zenith / surface normal)
- **Azimuth ($\phi$)**: Measured clockwise from North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$).
  $$\phi = \text{atan2}(+X, -Z) \pmod{360^\circ}$$
- **Elevation ($\theta$)**: Angle above local horizontal plane ($0^\circ = \text{horizon}, +90^\circ = \text{zenith}$).
  $$\theta = \arcsin\left(\frac{Y}{\sqrt{X^2 + Y^2 + Z^2}}\right)$$

### 2.2 Direction Vector from (Azimuth $\phi$, Elevation $\theta$)
Given azimuth $\phi$ and elevation $\theta$:
$$\mathbf{v} = \begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \begin{bmatrix} \cos(\theta)\sin(\phi) \\ \sin(\theta) \\ -\cos(\theta)\cos(\phi) \end{bmatrix}$$
*Verification check*:
- $(\phi=0^\circ, \theta=0^\circ) \implies [0, 0, -1]^T$ (North)
- $(\phi=90^\circ, \theta=0^\circ) \implies [1, 0, 0]^T$ (East)
- $(\theta=90^\circ) \implies [0, 1, 0]^T$ (Zenith)

### 2.3 Polar Stereographic Projection & Grid Convergence
Lunar south polar DEMs typically use the South Polar Stereographic projection with standard parallel at $-90^\circ$:
- For a point at longitude $\lambda$ (degrees East):
  $$\text{Grid Convergence Angle } \gamma = (\lambda - \lambda_0)$$
  where $\lambda_0$ is the projection center meridian.
- Topocentric true azimuth $\phi_{\text{true}}$ relates to grid azimuth $\phi_{\text{grid}}$ by:
  $$\phi_{\text{grid}} = \phi_{\text{true}} - \gamma$$
  *Crucial*: Always account for $\gamma$ when aligning ephemeris Azimuth vectors with grid terrain coordinates!

---

## 3. Lunar Curvature & Horizon Raycasting

### 3.1 Effective Elevation Correction
Due to spherical curvature, terrain at horizontal Euclidean distance $d$ drops relative to the observer's local horizontal plane:
$$\Delta h_{\text{curvature}}(d) = \frac{d^2}{2 R_{\text{moon}}}$$
$$h_{\text{eff}}(d) = h_{\text{terrain}}(d) - \frac{d^2}{2 R_{\text{moon}}}$$

*Drop table for $R = 1,737,400\text{ m}$*:
- $d = 1\text{ km} \implies \Delta h \approx 0.29\text{ m}$
- $d = 5\text{ km} \implies \Delta h \approx 7.19\text{ m}$
- $d = 10\text{ km} \implies \Delta h \approx 28.78\text{ m}$
- $d = 20\text{ km} \implies \Delta h \approx 115.11\text{ m}$
- $d = 50\text{ km} \implies \Delta h \approx 719.46\text{ m}$

### 3.2 Raycast Elevation Angle
For an observer at $h_{\text{obs}} = h_{\text{site}} + h_{\text{mast}}$:
$$\theta(d) = \arctan\left(\frac{h_{\text{eff}}(d) - h_{\text{obs}}}{d}\right)$$
For a given azimuth $\phi$, the 360° horizon profile is:
$$H(\phi) = \max_{d \in [d_{\text{min}}, d_{\text{max}}]} \theta(d, \phi)$$
Typically sampled in $1^\circ$ azimuth steps ($\phi \in \{0^\circ, 1^\circ, \dots, 359^\circ\}$).

---

## 4. Solar Radiation & Extended Disc Integration

### 4.1 Solar Distance Flux Scaling
Heliocentric distance $r$ varies between perihelion ($\sim 0.983\text{ AU}$) and aphelion ($\sim 1.017\text{ AU}$):
$$S(r) = S_0 \cdot \left(\frac{1\text{ AU}}{r}\right)^2$$
Flux variation is approximately $\pm 3.4\%$ throughout the year.

### 4.2 Partial Illumination Factor ($f_{\text{ill}}$)
Let $\theta_\odot$ be the center elevation of the Sun, and $H(\phi_\odot)$ the horizon elevation along the solar azimuth.
Let $R_\odot = 0.2665^\circ$ be the angular radius of the Sun.
$$\Delta = \theta_\odot - H(\phi_\odot)$$

1. **Fully below horizon**: $\Delta \le -R_\odot \implies f_{\text{ill}} = 0.0$
2. **Fully above horizon**: $\Delta \ge +R_\odot \implies f_{\text{ill}} = 1.0$
3. **Partial disc occultation**: $-R_\odot < \Delta < R_\odot$:
   Using circular segment area formula with normalized height $x = \Delta / R_\odot \in (-1, 1)$:
   $$f_{\text{ill}} = \frac{1}{\pi} \left[ \arccos(-x) + x \sqrt{1 - x^2} \right]$$
   *(Linear approximation: $f_{\text{ill}} \approx \frac{\Delta + R_\odot}{2 R_\odot}$)*

### 4.3 Solar Array Power Output Models
Given array area $A$ ($\text{m}^2$) and efficiency $\eta$:
1. **Vertical Azimuth-Tracking** (rotates to face Sun's azimuth, perpendicular to surface):
   $$P_{\text{vert}} = S(r) \cdot A \cdot \eta \cdot \max(0, \cos(\theta_\odot)) \cdot f_{\text{ill}}$$
   *(Ideal at lunar poles where $\theta_\odot \approx 0^\circ\text{ to }1.5^\circ$, giving $\cos(\theta_\odot) \approx 0.9996$)*
2. **Fixed Horizontal Array**:
   $$P_{\text{horiz}} = S(r) \cdot A \cdot \eta \cdot \max(0, \sin(\theta_\odot)) \cdot f_{\text{ill}}$$
3. **Two-Axis Tracking Array** (points directly at Sun):
   $$P_{\text{dual}} = S(r) \cdot A \cdot \eta \cdot f_{\text{ill}}$$

---

## 5. Direct-to-Earth (DTE) Link Geometry & Telemetry

### 5.1 Geometric Line-of-Sight
Earth visibility boolean:
$$\text{LOS}_{\text{DTE}} = \begin{cases} \text{TRUE} & \text{if } \theta_\oplus > H(\phi_\oplus) \\ \text{FALSE} & \text{otherwise} \end{cases}$$

### 5.2 Signal Travel Time & Path Loss
- **One-way Light Time**:
  $$\tau = \frac{\Delta_{\text{Earth}}}{c} \quad (\approx 1.25\text{ to }1.35\text{ seconds})$$
- **Free-Space Path Loss (FSPL)** at carrier frequency $f$ (e.g., S-band $2.2\text{ GHz}$, X-band $8.4\text{ GHz}$, Ka-band $26\text{ GHz}$):
  $$\text{FSPL (dB)} = 20 \log_{10}(\Delta_{\text{Earth}}) + 20 \log_{10}(f) + 20 \log_{10}\left(\frac{4\pi}{c}\right)$$
  For $\Delta = 384,400\text{ km}$ at $f = 8.4\text{ GHz}$ (X-band):
  $$\text{FSPL} \approx 20 \log_{10}(3.844 \times 10^8) + 20 \log_{10}(8.4 \times 10^9) - 147.55 \approx 222.6\text{ dB}$$

### 5.3 Active DSN Complex
Determined by Earth sub-lunar point longitude $\lambda_{\text{sub}}$:
- **Goldstone** (California, USA): $\approx 243.2^\circ\text{ E}$ ($116.8^\circ\text{ W}$)
- **Madrid** (Spain): $\approx 355.8^\circ\text{ E}$ ($4.2^\circ\text{ W}$)
- **Canberra** (Australia): $\approx 148.9^\circ\text{ E}$

---

## 6. Terrain Slope & Landing Hazard

### 6.1 Central Differences Slope
On regular grid with resolution $\Delta x = \Delta y = 20\text{ m}$:
$$p = \frac{\partial z}{\partial x} \approx \frac{z_{i+1, j} - z_{i-1, j}}{2 \Delta x}, \quad q = \frac{\partial z}{\partial y} \approx \frac{z_{i, j+1} - z_{i, j-1}}{2 \Delta y}$$
$$\alpha_{\text{slope}} = \arctan\left(\sqrt{p^2 + q^2}\right)$$

### 6.2 Footprint-Scale Slope
Fit a plane $z = ax + by + c$ by least squares over an $N \times N$ footprint ($w = N \cdot \Delta x$):
$$\alpha_{\text{footprint}} = \arctan\left(\sqrt{a^2 + b^2}\right)$$

### 6.3 Landing Hazard Evaluation
- Safe: $\alpha \le \alpha_{\text{threshold}}$ (default $15^\circ$)
- Warning: $0.8 \cdot \alpha_{\text{threshold}} \le \alpha \le \alpha_{\text{threshold}}$
- Hazard: $\alpha > \alpha_{\text{threshold}}$

---

## 7. Rover Traverse Kinematics & Energy Model

### 7.1 Path Slope Cost Function
For adjacent nodes $u \to v$ separated by distance $\Delta s$ with slope $\alpha$:
$$\text{Cost}(u \to v) = \begin{cases} \infty & \text{if } \alpha > \alpha_{\text{rover,max}} \\ \Delta s \cdot \left(1 + k_{\text{slope}} \cdot \tan^2(\alpha) + k_{\text{PSR}} \cdot \mathbb{I}_{\text{dark}}\right) & \text{otherwise} \end{cases}$$

### 7.2 Mechanical Energy Expenditure
$$E_{\text{segment}} = \Delta s \cdot \left[ C_{\text{roll}} \cdot m \cdot g_{\text{moon}} \cdot \cos(\alpha) + m \cdot g_{\text{moon}} \cdot \sin(\alpha) \right]$$
where $g_{\text{moon}} = 1.625\text{ m/s}^2$, $C_{\text{roll}} \approx 0.08\text{–}0.12$ (lunar regolith).
