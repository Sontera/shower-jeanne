# Guide de déploiement rapide

## Prérequis (déjà fait)

- Repo GitHub : `github.com/Sontera/shower-jeanne`
- Projet Firebase : `showerjeanne`
- Google Cloud Shell : `shell.cloud.google.com`

## Déployer une mise à jour

### 1. Commit + push (sur ton PC)

```bash
cd /home/charles/Syncthing/CMsync/1_Projets/ShowerJeanne
git add -A
git commit -m "description du changement"
git push
```

Ou via SourceGit : stage, commit, push.

### 2. Déployer (dans Google Cloud Shell)

Ouvre https://shell.cloud.google.com puis tape :

```bash
cd shower-jeanne && git pull && firebase deploy --only hosting
```

C'est tout. Le site est mis à jour en ~10 secondes.

### 3. Vérifier

- Ouvre https://showerjeanne.web.app/tv
- **Ctrl+Shift+R** pour forcer le rechargement sans cache

## Première fois dans Cloud Shell (si session expirée)

Si Cloud Shell a été réinitialisé ou si le dossier n'existe plus :

```bash
git clone https://github.com/Sontera/shower-jeanne.git
cd shower-jeanne
firebase login
firebase use showerjeanne
firebase deploy --only hosting
```

## URLs de l'app

| Vue | URL |
|-----|-----|
| TV (Chromecast) | https://showerjeanne.web.app/tv |
| Animateur | https://showerjeanne.web.app/admin |
| Joueurs | https://showerjeanne.web.app/play |

## Dépannage

- **Page ne change pas après deploy** : Ctrl+Shift+R (hard refresh)
- **firebase: command not found** dans Cloud Shell : `npm install -g firebase-tools` puis réessayer
- **Permission denied sur git push** : vérifier que le remote utilise SSH (`git@github.com:Sontera/shower-jeanne.git`)
