# Audit de localisation Kiswahili — Phase 2

## Architecture constatée

- Le frontend public centralise ses traductions dans `client-frontend/src/i18n/translations.js`; `LanguageProvider.jsx` conserve le choix sous `vanguard.client.lang`, expose `t()` et applique le fallback français.
- La console admin a son propre dictionnaire dans `admin-frontend/src/i18n/translations.js`; son fournisseur conserve le choix sous `vanguard.lang` et utilise aussi le français comme fallback.
- Les sélecteurs existants proposent Français, English et Kiswahili. Le changement est immédiat et les deux choix sont indépendants, sans changement de session ou d’authentification.
- Les erreurs métier viennent soit des clés frontend, soit des réponses API/prestataires. Seules les erreurs connues et structurées côté frontend sont localisées; les réponses backend et messages externes restent intacts.

## Couverture réalisée

Le site public (534 valeurs chaîne du dictionnaire) couvre maintenant les contenus institutionnels et de présentation, les services, la réservation et le paiement transport, Mobile Money, colis et suivi, construction, automobile, contact, les libellés du ticket imprimable, les erreurs structurées et les états de colis. Les textes directs repérés dans les composants touchés ont été remplacés par `t()`. Les différences SW/FR restantes au public sont des noms propres, noms de marque, noms de lieux, chiffres, unités, coordonnées ou noms de langues (24 valeurs), qui sont volontairement conservés.

Dans la console, les sections Agent et Manager ont reçu des traductions revues pour le tableau de bord, opérations, paiements, colis, états et clôture de caisse; plusieurs sections de compte, agence, personnel, notifications, permissions et erreurs ont aussi été traduites. La copie Swahili des sections imbriquées modifiées est indépendante du dictionnaire français.

## Finalisation Phase 3

L’audit de départ de cette phase a confirmé les 1 409 valeurs SW identiques au français sur 2 108 entrées relevées pendant la Phase 2. Les dictionnaires de la console ont depuis été complétés et les modules imbriqués modifiés sont copiés avant traduction afin de ne pas modifier les références FR/EN.

Le différentiel actuel comprend 2 362 valeurs texte admin en français; 2 355 valeurs SW sont différentes du français. Les sept valeurs identiques sont des noms de marque ou de fournisseur volontairement conservés : `Vanguard Coach` (3 occurrences), `Vanguard Automobile`, `Vanguard Construction` et `Mobile Money (MbiyoPay)` (2 occurrences). Aucune autre égalité FR/SW n’a été relevée dans le dictionnaire admin. Le script de clés a détecté 1 408 clés `t()` statiques sur 93 fichiers et chacune est définie en FR, EN et SW.

Les modules d’administration couverts par le dictionnaire sont Agent, Manager, Service Admin et Super Admin, dont la navigation, les opérations Coach, les clôtures de caisse, les ressources, les utilisateurs, les rôles/permissions, les agences, AutoSales, Construction, l’audit, le compte, les notifications, les états, les formulaires et les médias. Des textes directs repérés dans les modèles de construction, les permissions, la fiche agence, les composants média et les libellés de rôles ont été déplacés vers les traductions. La recherche heuristique des nœuds JSX a encore renvoyé 88 candidats, dont des expressions JSX mal segmentées, marques, devises, codes de données, formats de papier, noms de langues et opérateurs Mobile Money; elle ne constitue pas une preuve de parcours visuel.

Les données utilisateur libres (noms, descriptions et notes), les intitulés stockés en base, les résultats externes de prestataires ainsi que plusieurs messages backend restent transmis tels que retournés par l’API dans certains écrans. L’audit a relevé environ 30 usages directs de `response.data.message` dans les formulaires et états d’erreur. Les sources comprennent les réponses de contrôleurs admin/utilisateur/rôle, les services d’authentification et de colis, les réponses du prestataire MbiyoPay et les messages de validation de billet de `ticketService` (certains français, d’autres anglais). Les réponses ne sont pas masquées et aucun contrat métier n’a été changé. Une localisation complète nécessite soit des codes de message stables déjà contractuels, soit une table frontend exacte pour les messages répertoriés, sans transformer les messages inconnus/dynamiques. Les messages libres des notifications enregistrées sont également des données, pas des libellés d’interface. Le tableau d’alertes Manager fournit déjà `messageKey` et ses libellés sont traduits côté frontend.

Le rendu serveur EJS `views/pages/ticket-print.ejs` a été localisé en FR/EN/SW. Les contrôleurs de rendu n’acceptent qu’un paramètre `lang` autorisé, avec fallback FR; le client d’impression le transmet désormais. Les montants, itinéraires, références et données de billet restent inchangés. Le reçu de colis imprimable du frontend conserve les champs traduits et utilise la locale Swahili pour les dates.

## Fichiers touchés pendant la Phase 2

- Client: `src/i18n/translations.js`, `src/i18n/LanguageProvider.jsx`, `src/components/ErrorBoundary.jsx`, `src/pages/Home.jsx`, `Transport.jsx`, `Ticket.jsx`, `Automobile.jsx`, `VehicleDetail.jsx`, `ProjectDetail.jsx`, `src/utils/vehiclePresentation.js`.
- Console: `src/i18n/translations.js`, `src/i18n/LanguageProvider.jsx`, `src/layouts/AdminLayout.jsx`, `qa-check-translations.mjs`.
- Documentation et audit: `docs/swahili-localization-audit.md`, `scripts/auditSwTranslations.mjs`, `scripts/printTranslationSection.mjs`.

## Vérifications Phase 3

- `node admin-frontend/qa-check-translations.mjs` (depuis `admin-frontend`): succès; 1 408 clés statiques résolues sur 93 fichiers; 2 362 clés FR et 2 362 EN, sans différence de structure.
- `node scripts/auditSwTranslations.mjs`: 2 362 valeurs SW admin analysées; aucune chaîne SW manquante dans les clés FR; 7 égalités avec FR, toutes justifiées ci-dessus. Côté client, 533 chaînes FR sont couvertes, sans chaîne SW manquante, et 24 égalités sont des noms propres/lieux, chiffres, unités, coordonnées, moyens de paiement ou noms de langue; 12 clés client SW supplémentaires couvrent les états de colis et le libellé Kiswahili.
- Un contrôle lexical ciblé n’a trouvé qu’une chaîne admin Kiswahili avec un caractère diacritique français : `resourcePlaceholders.firstName = Mfano: Dieudonné`; il s’agit d’un nom propre d’exemple.
- Lint admin et client: succès avec avertissements préexistants pour des clés FR/EN dupliquées dans le dictionnaire admin et `ticketStatus` inutilisée côté client.
- Builds client (Vite 8.2.1) et admin (Vite 8.2.0): succès sur la révision finale, sans erreur.
- `npm test`: 180 réussites, 42 échecs. Les erreurs comprennent trois scripts scratch en désaccord avec les champs/implémentations actuels (`departureAt` et assertions du flux média), les tests d’intégration/backend qui réclament `JWT_SECRET`, `SESSION_SECRET`, `DATABASE_URL` ou `TICKET_QR_SECRET`, les tests media dépendant de Cloudinary/backend et des assertions de cloisonnement Manager bloquées par la configuration manquante. Les résultats détaillés sont dans la sortie de la suite; aucun test n’a modifié de données de production.
- `git diff --check`: aucune erreur de whitespace; avertissements de conversion LF/CRLF Windows.
- Les fournisseurs de langue conservent leurs mécanismes de persistance existants (`vanguard.lang` admin, `vanguard.client.lang` public), mais les parcours runtime FR→EN, FR→SW, EN→SW et la persistance par actualisation n’ont pas pu être exercés dans un navigateur. Le helper Computer Use Windows a expiré à deux reprises lors de l’initialisation; aucun accès authentifié aux profils Agent, Manager, Service Admin ou Super Admin n’était disponible.
