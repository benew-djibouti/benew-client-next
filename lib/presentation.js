// =============================
// CONTENUS DES CATÉGORIES
// =============================
export const categoryContents = {
  vision: {
    title: 'Notre Vision',
    paragraphs: [
      "Chez BeNew, nous croyons en l'innovation.",
      'Nous croyons en notre pouvoir à accomplir de grandes choses pour notre pays.',
      'Nous croyons en notre capacité à le transformer — et de nous élever avec lui.',

      'Nous croyons en notre potentiel à rivaliser avec les grandes nations.',
      "Nous croyons en la richesse de nos talents, prêts à s'exprimer pleinement.",

      "Dans un monde en pleine mutation, nous refusons l'attente.",
      "Nous choisissons d'être des catalyseurs, pas des suiveurs.",
      'Des créateurs, pas de simples consommateurs.',

      'Notre mission est claire : proposer des solutions modernes, innovantes et utiles.',
      "Et tracer la voie vers l'excellence, chaque jour un peu plus.",

      'Chez BeNew, nous croyons en vous.',
      'Et vous ? Croyez-vous en vous-même ?',
    ],
  },
  offre: {
    title: "L'offre",
    paragraphs: [
      "Nous vous proposons des magasins en ligne, appelés aussi boutiques e-commerce ou sites web e-commerce, sous forme d'abonnement.",

      "Notre offre est une première puisqu'elle permet de se concentrer pleinement sur votre affaire/métier sans se soucier de la complexité liée au bon fonctionnement du magasin.",
    ],
  },
  modeles: {
    title: 'Les modèles',
    paragraphs: [
      "Un modèle, dans notre cas, est un site web qui est à l'origine de plusieurs magasins. Chaque modèle sera à l'origine de plusieurs magasins de différents niveau et catégorie.",

      "Nos modèles sont identiques sur le fond car ils permettent tous de vendre tout type d'objet mais sont différents sur la forme (architecture, thème, …).",

      "Nous venons de publier notre premier modèle et nous comptons en publier d'autres.",
    ],
  },
  magasins: {
    title: 'Les magasins',
    paragraphs: [
      'Nos magasins, plus connus sous les appellations boutiques e-commerce ou sites web e-commerce, sont créés et adaptés pour Djibouti.',

      'Ils intègrent tous les moyens de paiement électronique mobile existants et sont accessibles financièrement.',

      'Chaque magasin aura une catégorie, site web ou application mobile, et un niveau qui sera déterminé par les fonctionnalités et les pages du magasin.',

      "Les différents niveaux sont, dans l'ordre croissant :",
      '• Magasin Simplifié – MS (le moins cher)',
      '• Magasin Standard – MS+',
      '• Magasin Supérieur – MS2+',
      '• Magasin Sophistiqué – MS*',
      '• Magasin Premium – MP (le plus cher)',

      "À chaque fois que l'on passe au niveau supérieur d'un magasin, des nouvelles fonctionnalités et des nouvelles pages s'ajoutent.",

      'Nous venons de lancer les premiers magasins de notre premier modèle.',
    ],
  },
  travail: {
    title: 'Le travail',
    paragraphs: [
      "Chez BeNew, nous croyons au travail bien fait et à l'excellence dans chaque détail.",

      "Notre équipe s'engage à fournir un accompagnement complet tout au long de votre parcours e-commerce.",

      'Du développement initial à la maintenance continue, nous sommes là pour assurer le succès de votre magasin en ligne.',
    ],
  },
  technologies: {
    title: 'Les technologies',
    paragraphs: [
      'Nous utilisons les technologies les plus modernes et performantes pour garantir la fiabilité et la rapidité de nos magasins.',

      'Nos plateformes sont conçues avec des frameworks de pointe, assurant une expérience utilisateur fluide et sécurisée.',

      "L'intégration des moyens de paiement mobile locaux est au cœur de notre approche technologique, permettant à vos clients de payer facilement et en toute sécurité.",

      "Nous restons constamment à l'écoute des évolutions technologiques pour vous offrir le meilleur du web moderne.",
    ],
  },
  formule: {
    title: 'La formule',
    paragraphs: [
      "Notre formule d'abonnement est simple et transparente.",

      'Vous choisissez le niveau de magasin qui correspond à vos besoins, et nous nous occupons de tout le reste : hébergement, maintenance, mises à jour et support technique.',

      'Pas de frais cachés, pas de surprises. Juste un service de qualité à un prix accessible.',

      "Cette formule vous permet de vous concentrer sur l'essentiel : développer votre activité et satisfaire vos clients.",
    ],
  },
  prix: {
    title: 'Le prix',
    paragraphs: [
      'Nos prix sont conçus pour être accessibles aux entreprises djiboutiennes de toutes tailles.',

      'Chaque niveau de magasin (MS, MS+, MS2+, MS*, MP) correspond à un tarif mensuel adapté aux fonctionnalités proposées.',

      "Notre objectif est de démocratiser l'accès au e-commerce à Djibouti en proposant des solutions professionnelles à des prix compétitifs.",
    ],
  },
};

// Données des catégories avec leurs contenus associés
export const categories = [
  { id: 'offre', title: "L'offre", icon: '🚀', contentKey: 'offre' },
  { id: 'modeles', title: 'Les modèles', icon: '☀️', contentKey: 'modeles' },
  { id: 'magasins', title: 'Les magasins', icon: '🪐', contentKey: 'magasins' },
  { id: 'travail', title: 'Le travail', icon: '☄️', contentKey: 'travail' },
  {
    id: 'technologies',
    title: 'Les technologies',
    icon: '🛸',
    contentKey: 'technologies',
  },
  { id: 'formule', title: 'La formule', icon: '🌌', contentKey: 'formule' },
  { id: 'prix', title: 'Le prix', icon: '💰', contentKey: 'prix' },
];
