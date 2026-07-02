# 🎮 Horizontal Twitch Chat Widget

Widget de chat Twitch horizontal pour **StreamElements** (OBS / Streamlabs OBS). Les messages s'affichent côte à côte de gauche à droite (ou de droite à gauche), avec avatar, badges et emotes.

---

## 📸 Aperçu

Deux styles disponibles :

| Style | Description |
|-------|-------------|
| **Avec avatar** | Affiche la photo de profil Twitch (ou les initiales) à gauche du message |
| **Sans avatar** | Version compacte sans photo de profil |

---

## 🚀 Installation dans StreamElements

### Étape 1 — Créer un widget personnalisé

1. Connecte-toi sur [StreamElements](https://streamelements.com)
2. Rends-toi dans **My Overlays** → **Add Layer** → **Widgets** → **Custom Widget**
3. Clique sur **Open Editor**

### Étape 2 — Copier les fichiers

| Onglet StreamElements | Fichier à copier |
|----------------------|------------------|
| **HTML** | Contenu de `index.html` |
| **CSS** | Contenu de `style.css` |
| **JS** | Contenu de `widget.js` |
| **Fields** | Contenu de `fields.json` |

### Étape 3 — Sauvegarder et positionner

1. Clique sur **Done** puis **Save**
2. Redimensionne la zone du widget pour qu'elle occupe la largeur souhaitée en bas (ou haut) de l'écran
3. Les options de personnalisation apparaissent dans le panneau de droite

---

## ⚙️ Options de personnalisation

### Général

| Option | Description | Valeur par défaut |
|--------|-------------|-------------------|
| `hideAfter` | Masquer le message après N secondes (0 = jamais) | `0` |
| `hideCommands` | Masquer les messages commençant par `!` | `Yes` |
| `scrollDirection` | Direction de défilement | `Left to Right` |
| `googleFont` | Nom de la police Google Fonts | `Barlow Condensed` |
| `spacing` | Espacement entre les messages | `15` |

### Avatar

| Option | Description | Valeur par défaut |
|--------|-------------|-------------------|
| `showAvatars` | Afficher / cacher les avatars | `Yes` |
| `fitContentWidth` | Adapter la largeur au contenu | `Yes` |
| `avatarMode` | `Twitch` (photo de profil) ou `Initials` (initiales) | `Twitch` |
| `avatarSize` | Taille de l'avatar en pixels | `60` |
| `avatarInitialsBg` | Couleur de fond des initiales | `#AA4DDA` |
| `avatarInitialsColor` | Couleur du texte des initiales | `#FFFFFF` |
| `avatarBorderColor` | Couleur de la bordure de l'avatar | `#FFFFFF` |

### Badges

| Option | Description | Valeur par défaut |
|--------|-------------|-------------------|
| `showBadges` | Afficher / cacher les badges | `Yes` |
| `badgeSize` | Taille des badges en pixels | `25` |

### Nom d'utilisateur

| Option | Description | Valeur par défaut |
|--------|-------------|-------------------|
| `usernameTransform` | Casse : Default / Uppercase / Lowercase | `Default` |
| `usernameColorType` | `Custom Color` ou `Twitch Color` (couleur native) | `Custom Color` |
| `usernameColor` | Couleur hex du nom (si type = Custom) | `#039BEF` |
| `usernameShadowColor` | Couleur de l'ombre du nom | `rgba(255,255,255,0)` |
| `usernameFontSize` | Taille de la police du nom | `25` |

### Message

| Option | Description | Valeur par défaut |
|--------|-------------|-------------------|
| `messageColor` | Couleur du texte du message | `#CDEDF2` |
| `messageBg` | Couleur de fond du message | `rgba(0,0,0,0.5)` |
| `messageFontSize` | Taille de la police du message | `25` |
| `borderWidth` | Épaisseur de la bordure gauche | `13` |
| `borderColor` | Couleur de la bordure gauche | `#039BEF` |

---

## 🎭 Support des Emotes

Le widget supporte :

- ✅ **Emotes Twitch natives** — parsées via l'objet `emotes` fourni par StreamElements
- ✅ **Emotes BTTV / FFZ / 7TV** — parsées via `emoteSet` (si configuré dans StreamElements)
- ✅ **Fallback** — si l'image d'un avatar ne charge pas, les initiales s'affichent

---

## 📐 Dimensionnement recommandé

- **Largeur** : 100% de la largeur de ton canvas (ex : 1920px)
- **Hauteur** : 100–150px suffit pour 1 ligne de messages
- **Position** : en bas de l'écran, au-dessus des autres éléments

---

## 🎨 Personnalisation avancée

Pour une police Google Fonts personnalisée, entre exactement le nom tel qu'il apparaît sur [fonts.google.com](https://fonts.google.com), par exemple :
- `Barlow Condensed`
- `Bebas Neue`
- `Roboto`
- `Oswald`

---

## 📝 Licence

MIT — libre d'utilisation et de modification.
