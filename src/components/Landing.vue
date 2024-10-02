<template>
  <div>
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <h1>{{ heroTitle }}</h1>
        <p>{{ heroSubtitle }}</p>
        <button class="btn" @click="getStarted">Get Started</button>
        <button class="btn" @click="exploreArt">Explore Art</button>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features container">
      <div v-for="feature in features" :key="feature.id" class="feature">
        <img :src="feature.image" :alt="feature.title" />
        <h2>{{ feature.title }}</h2>
        <p>{{ feature.description }}</p>
      </div>
    </section>

    <!-- Future Features Section -->
    <section class="future-features container">
      <h2 @click="toggleFutureFeatures">Coming Soon to Fiddl.art</h2>
      <div v-if="showFutureFeatures" class="features">
        <div v-for="feature in futureFeatures" :key="feature.id" class="feature">
          <img :src="feature.image" :alt="feature.title" />
          <h2>{{ feature.title }}</h2>
          <p>{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- Gallery Section -->
    <section class="gallery container">
      <h2>Explore Art Created by the Fiddl.art Community</h2>
      <div class="gallery-grid">
        <div v-for="item in galleryItems" :key="item.id" class="gallery-item">
          <img :src="item.image" :alt="`Gallery Image ${item.id}`" />
        </div>
      </div>
      <button class="btn" @click="loadMoreImages">Browse More</button>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>&copy; 2024 Fiddl.art. All rights reserved.</p>
    </footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      heroTitle: "Unleash Your Creativity with AI Art",
      heroSubtitle: "Generate, Explore, and Share Stunning AI Art with Fiddl Points!",
      features: [
        { id: 1, title: "Generate AI Art", description: "Use Fiddl points to create images with AI or brainstorm new ideas!", image: "https://via.placeholder.com/50" },
        { id: 2, title: "Browse & Share", description: "Discover what others have created. Download, share, and upvote your favorite pieces.", image: "https://via.placeholder.com/50" },
        { id: 3, title: "Improve Your Prompts", description: "Get AI assistance to enhance your image generation prompts.", image: "https://via.placeholder.com/50" },
      ],
      futureFeatures: [
        { id: 1, title: "High-Res Downloads", description: "Pay to download 4K upscaled images.", image: "https://via.placeholder.com/50" },
        { id: 2, title: "Earn Fiddl Points", description: "Receive points when your images are purchased.", image: "https://via.placeholder.com/50" },
        { id: 3, title: "NFT Minting", description: "Top-voted images become collectible NFTs.", image: "https://via.placeholder.com/50" },
        { id: 4, title: "AI Model Variety", description: "Connect with various AI models, including Boid AI for discounted image generation.", image: "https://via.placeholder.com/50" },
      ],
      showFutureFeatures: false,
      galleryItems: [
        { id: 1, image: "https://via.placeholder.com/300" },
        { id: 2, image: "https://via.placeholder.com/300" },
        { id: 3, image: "https://via.placeholder.com/300" },
      ],
    }
  },
  methods: {
    getStarted() {
      alert("Redirecting to the sign-up page...")
    },
    exploreArt() {
      alert("Redirecting to the art gallery...")
    },
    toggleFutureFeatures() {
      this.showFutureFeatures = !this.showFutureFeatures
    },
    loadMoreImages() {
      // Example of loading more images (dynamically adding items to the gallery)
      const newItems = [
        { id: 4, image: "https://via.placeholder.com/300" },
        { id: 5, image: "https://via.placeholder.com/300" },
        { id: 6, image: "https://via.placeholder.com/300" },
      ]
      this.galleryItems = [...this.galleryItems, ...newItems]
    },
  },
}
</script>

<style scoped>
/* Basic Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Body Styling */
body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

/* Container */
.container {
  width: 90%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Hero Section */
.hero {
  /* background: url("https://via.placeholder.com/1200x400") no-repeat center center/cover; */
  color: white;
  text-align: center;
  padding: 50px 20px;
}

.hero h1 {
  font-size: 2.5em;
  margin-bottom: 20px;
}

.hero p {
  font-size: 1.2em;
  margin-bottom: 20px;
}

.hero .btn {
  display: inline-block;
  margin: 10px;
  padding: 10px 20px;
  background: #ff6347;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  cursor: pointer;
}

/* Features Section */
.features {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  text-align: center;
  padding: 50px 0;
}

.feature {
  flex: 1 1 30%;
  margin: 10px;
}

.feature img {
  width: 50px;
  height: 50px;
}

/* Future Features Section */
.future-features {
  padding: 50px 0;
  background: #f4f4f4;
  text-align: center;
}

.future-features .feature {
  flex: 1 1 45%;
  margin: 10px;
}

/* Gallery Section */
.gallery {
  padding: 50px 0;
}

.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.gallery-item {
  flex: 1 1 30%;
  margin: 10px;
}

.gallery-item img {
  width: 100%;
  height: auto;
}

/* Footer */
.footer {
  padding: 20px;
  background: #333;
  color: white;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .features,
  .future-features,
  .gallery-grid {
    flex-direction: column;
  }

  .feature,
  .gallery-item {
    flex: 1 1 100%;
  }
}
</style>
