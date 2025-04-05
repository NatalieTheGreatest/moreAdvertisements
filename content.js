// Configuration
const config = {
    adImages: ["images/add1.png", "images/add2.png", "images/add4.png", "images/add5.png", "images/add6.png", "images/add3.png"],
    adLink: 'https://www.walmart.com/',
    maxAdSize: { width: 300, height: 250 },
    adPlacementOptions: {
      defaultMaxTotal: 5,
      defaultMaxFixed: 1,
      scrolledContentMaxTotal: 2,
      scrolledContentMaxFixed: 0
    }
  };
  
  // Making sure not too many ads
  function calculateAdDensity() {
    const viewportArea = window.innerWidth * window.innerHeight;
    const adElements = document.querySelectorAll('.extension-added-ad, .extension-fixed-ad');
    
    let totalAdArea = 0;
    adElements.forEach(ad => {
      const rect = ad.getBoundingClientRect();
      totalAdArea += rect.width * rect.height;
    });
    
    return totalAdArea / viewportArea; // Returns ratio (0-1) of screen covered by ads
  }
 
  // State tracking
  let processedPageHeight = window.innerHeight;
  
  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  // DOM Element creation
  const adBuilder = {
    createAdContainer(width, height, positionStyles = {}) {
      const adContainer = document.createElement('div');
      adContainer.className = 'extension-added-ad';
      adContainer.style.width = `${width}px`;
      adContainer.style.height = `${height}px`;
      adContainer.style.position = positionStyles.position || 'absolute';
      adContainer.style.zIndex = '1000';
      adContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      adContainer.style.backgroundColor = '#fff';
      adContainer.style.border = '1px solid #ddd';
      adContainer.style.borderRadius = '3px';
      
      // Apply position styles
      Object.keys(positionStyles).forEach(key => {
        adContainer.style[key] = positionStyles[key];
      });
      
      return adContainer;
    },
    
    createAdContent(adContainer) {
      // Create link element
      const link = document.createElement('a');
      link.href = config.adLink;
      link.target = '_blank';
      
      // Create image element
      const img = document.createElement('img');
      const randomIndex = Math.floor(Math.random() * config.adImages.length);
      img.src = chrome.runtime.getURL(config.adImages[randomIndex]);
      
      img.onerror = () => {
        console.error("Failed to load image:", img.src);
        // Try a different image
        const newIndex = (randomIndex + 1) % config.adImages.length;
        img.src = chrome.runtime.getURL(config.adImages[newIndex]);
      };
      
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      
      // Add close button
      const closeBtn = this.createCloseButton(() => adContainer.remove());
      
      // Assemble elements
      link.appendChild(img);
      adContainer.appendChild(link);
      adContainer.appendChild(closeBtn);
      
      return adContainer;
    },
    
    createCloseButton(onClickHandler) {
      const closeBtn = document.createElement('div');
      closeBtn.textContent = '✕';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '2px';
      closeBtn.style.right = '2px';
      closeBtn.style.backgroundColor = 'rgba(0,0,0,0.5)';
      closeBtn.style.color = 'white';
      closeBtn.style.width = '16px';
      closeBtn.style.height = '16px';
      closeBtn.style.borderRadius = '8px';
      closeBtn.style.textAlign = 'center';
      closeBtn.style.lineHeight = '16px';
      closeBtn.style.fontSize = '10px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '1001';
      
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClickHandler();
      });
      
      return closeBtn;
    }
  };
  
  // Space finding strategies
  const spaceFinder = {
    // Find divs suitable for ad placement
    findDivsForAds(options = {}) {
      const {
        paddingThreshold = 50,
        minDivHeight = 200,  
        maxAdsPerPage = 5,
        prioritizeVisible = true
      } = options;
      
      const divs = document.querySelectorAll("div");
      const validDivs = [];
      
      divs.forEach(div => {
        // Skip tiny divs or divs that already have ads
        if (div.offsetWidth < 200 || div.offsetHeight < minDivHeight || 
            div.querySelector('.extension-added-ad')) return;
          
        const style = window.getComputedStyle(div);
        const rect = div.getBoundingClientRect();
        
        // Check if div is potentially visible
        const isVisible = !(
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0' ||
          rect.width === 0 ||
          rect.height === 0
        );
        
        if (!isVisible) return;
        
        // Calculate placement criteria scores
        const hasPadding = (
          parseFloat(style.paddingTop) > paddingThreshold || 
          parseFloat(style.paddingBottom) > paddingThreshold ||
          parseFloat(style.paddingLeft) > paddingThreshold ||
          parseFloat(style.paddingRight) > paddingThreshold
        );
        
        const hasMargin = (
          parseFloat(style.marginTop) > paddingThreshold || 
          parseFloat(style.marginBottom) > paddingThreshold
        );
        
        const hasBackground = (
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
          style.backgroundColor !== 'transparent'
        );
        
        // Calculate visibility score
        let visibilityScore = 0;
        if (prioritizeVisible) {
          const viewportHeight = window.innerHeight;
          if (rect.top >= 0 && rect.bottom <= viewportHeight) {
            visibilityScore = 3; // Fully visible
          } else if (rect.top < viewportHeight && rect.bottom > 0) {
            visibilityScore = 2; // Partially visible
          } else if (rect.top > 0 && rect.top < viewportHeight * 2) {
            visibilityScore = 1; // Just below viewport
          }
        }
        
        // Calculate placement score
        let placementScore = 0;
        if (hasPadding) placementScore += 2;
        if (hasMargin) placementScore += 1;
        if (hasBackground) placementScore += 1;
        if (div.children.length > 0) placementScore += 1;
        if (rect.width > 400) placementScore += 2;
        
        const totalScore = visibilityScore * 3 + placementScore;
        
        validDivs.push({
          element: div,
          rect,
          score: totalScore,
          isInViewport: visibilityScore > 1
        });
      });
      
      // Sort by score and limit to max ads
      return validDivs
        .sort((a, b) => b.score - a.score)
        .slice(0, maxAdsPerPage);
    },
    
    // Find fixed positions for ads
    getFixedPositionSpots() {
      return [
        // Right side banner
        {
          position: 'fixed',
          right: '10px',
          top: '50px',
          width: '160px',
          height: '600px',
          zIndex: 1000
        },
        // Top banner
        // {
        //   position: 'fixed',
        //   top: '10px',
        //   left: '50%',
        //   transform: 'translateX(-50%)',
        //   width: '728px',
        //   height: '90px',
        //   zIndex: 1000
        // },
        // Bottom right corner
        {
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          width: '300px',
          height: '250px',
          zIndex: 1000
        }
      ];
    },
    
    // Find whitespace areas (fallback)
    findWhiteSpaces() {
      // Use fixed position strategy for simplicity
      return this.getFixedPositionWhitespaces();
    },
    
    getFixedPositionWhitespaces() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaces = [];
      
      // Right sidebar
      if (viewportWidth > 1200) {
        const rightSidebarWidth = Math.min(300, viewportWidth * 0.2);
        spaces.push({
          left: viewportWidth - rightSidebarWidth - 20,
          top: 100,
          width: rightSidebarWidth,
          height: viewportHeight - 200
        });
      }
      
      // Footer area
      spaces.push({
        left: 50,
        top: viewportHeight - 150,
        width: viewportWidth - 100,
        height: 100
      });
      
      // Limit space sizes
      return this.subdivideSpaces(this.filterOverlappingSpaces(spaces));
    },
    
    // Break large spaces into smaller ones
    subdivideSpaces(spaces) {
      const { width: maxWidth, height: maxHeight } = config.maxAdSize;
      const result = [];
      
      spaces.forEach(space => {
        // If space is too wide, split horizontally
        if (space.width > maxWidth * 1.5) {
          const columns = Math.floor(space.width / maxWidth);
          const columnWidth = Math.floor(space.width / columns);
          
          for (let i = 0; i < columns; i++) {
            result.push({
              left: space.left + (i * columnWidth),
              top: space.top,
              width: columnWidth,
              height: Math.min(space.height, maxHeight)
            });
          }
        } 
        // If space is too tall, split vertically
        else if (space.height > maxHeight * 1.5) {
          const rows = Math.floor(space.height / maxHeight);
          const rowHeight = Math.floor(space.height / rows);
          
          for (let i = 0; i < rows; i++) {
            result.push({
              left: space.left,
              top: space.top + (i * rowHeight),
              width: Math.min(space.width, maxWidth),
              height: rowHeight
            });
          }
        } 
        // Otherwise just limit the size
        else {
          result.push({
            left: space.left,
            top: space.top,
            width: Math.min(space.width, maxWidth),
            height: Math.min(space.height, maxHeight)
          });
        }
      });
      
      return result;
    },
    
    // Remove overlapping spaces
    filterOverlappingSpaces(spaces) {
      const result = [];
      
      // Sort by area (largest first)
      spaces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
      spaces.forEach(space => {
        // Check if this space overlaps with any space already in result
        const overlaps = result.some(existing => {
          return !(
            space.left >= existing.left + existing.width ||
            space.left + space.width <= existing.left ||
            space.top >= existing.top + existing.height ||
            space.top + space.height <= existing.top
          );
        });
        
        if (!overlaps) {
          result.push(space);
        }
      });
      
      return result;
    }
  };
  
  // Ad placement methods
  const adPlacer = {
    // Place ads in suitable divs
    insertAdsInDivs(divData) {
      console.log(`Starting to insert ads in ${divData.length} selected divs`);
      let adCount = 0;
      
      divData.forEach(({ element, rect, isInViewport }, index) => {
        // Calculate ad dimensions based on div size
        const adWidth = Math.min(config.maxAdSize.width, rect.width * 0.8);
        const adHeight = Math.min(config.maxAdSize.height, adWidth * 0.75);
        
        // Determine position within div
        const positionStyles = {};
        
        // Vertical position
        if (isInViewport) {
          positionStyles.top = '10px';
        } else {
          const positionVariant = index % 3;
          if (positionVariant === 0) {
            positionStyles.top = '10px';
          } else if (positionVariant === 1) {
            positionStyles.top = `${(rect.height - adHeight) / 2}px`;
          } else {
            positionStyles.bottom = '10px';
          }
        }
        
        // Horizontal position
        const horizontalPosition = index % 3;
        if (horizontalPosition === 0) {
          positionStyles.left = '10px';
        } else if (horizontalPosition === 1) {
          positionStyles.left = `${(rect.width - adWidth) / 2}px`;
        } else {
          positionStyles.right = '10px';
        }
        
        // Create ad container
        const adContainer = adBuilder.createAdContainer(adWidth, adHeight, positionStyles);
        
        // Make sure parent can handle absolute positioning
        const originalPosition = window.getComputedStyle(element).position;
        if (originalPosition === 'static') {
          element.style.position = 'relative';
        }
        
        // Add content to ad container
        adBuilder.createAdContent(adContainer);
        
        // Add to DOM
        element.appendChild(adContainer);
        adCount++;
      });
      
      console.log(`Successfully placed ${adCount} ads in divs`);
      return adCount;
    },
    
    // Place ads in fixed positions
    placeFixedPositionAds(maxAds = 2) {
      console.log("Placing fixed position ads");
      
      // Check if we already have fixed position ads
      const existingAds = document.querySelectorAll('.extension-fixed-ad');
      if (existingAds.length >= maxAds) {
        console.log(`Already have ${existingAds.length} fixed ads, skipping`);
        return 0;
      }
      
      const placementSpots = spaceFinder.getFixedPositionSpots();
      const adsToPlace = Math.min(maxAds - existingAds.length, placementSpots.length);
      let adCount = 0;
      
      // Place new ads
      for (let i = 0; i < adsToPlace; i++) {
        const spotConfig = placementSpots[i];
        
        // Create and place ad
        const adContainer = adBuilder.createAdContainer(
          spotConfig.width, 
          spotConfig.height, 
          spotConfig
        );
        adContainer.classList.add('extension-fixed-ad');
        
        // Add content to ad container
        adBuilder.createAdContent(adContainer);
        
        // Add to DOM
        document.body.appendChild(adContainer);
        adCount++;
      }
      
      console.log(`Placed ${adCount} fixed position ads`);
      return adCount;
    },
    
    // Place ads in whitespace areas (fallback method)
    insertAdInWhitespace(space) {
      // Create ad container
      const adContainer = adBuilder.createAdContainer(
        space.width, 
        space.height, 
        { 
          left: space.left + 'px',
          top: space.top + 'px' 
        }
      );
      
      // Add content to ad container
      adBuilder.createAdContent(adContainer);
      
      // Add to DOM
      document.querySelector('body').appendChild(adContainer);
      return 1;
    }
  };
  
  // Main coordination function
  function placeAdsOnPage(options = {}) {

      // Check current ad density first
  const currentDensity = calculateAdDensity();
  const maxDensity = 0.3; // Don't cover more than 30% of screen with ads
  
  if (currentDensity >= maxDensity) {
    console.log("Ad density limit reached, skipping placement");
    return 0;
  }
    const {
      maxTotalAds = config.adPlacementOptions.defaultMaxTotal, 
      maxFixedAds = config.adPlacementOptions.defaultMaxFixed,
    } = options;
    
    console.log("Starting ad placement with max total:", maxTotalAds);
    let adsPlaced = 0;
    
    // 1. First try div-based placement (prioritize these)
    const divTargets = spaceFinder.findDivsForAds({
      paddingThreshold: 50,
      minDivHeight: 150,
      maxAdsPerPage: maxTotalAds - adsPlaced,
      prioritizeVisible: true
    });
    
    adsPlaced += adPlacer.insertAdsInDivs(divTargets);
    console.log(`Total ads placed after div insertion: ${adsPlaced}`);
    
    // 2. If we still need more ads, try fixed positions
    if (adsPlaced < maxTotalAds) {
      adsPlaced += adPlacer.placeFixedPositionAds(
        Math.min(maxFixedAds, maxTotalAds - adsPlaced)
      );
    }
    
    // 3. If still under limit, use the whitespace detection as fallback
    if (adsPlaced < maxTotalAds) {
      const remainingAds = maxTotalAds - adsPlaced;
      console.log(`Still need ${remainingAds} ads, using whitespace detection`);
      
      const whitespaces = spaceFinder.findWhiteSpaces();
      const limitedSpaces = whitespaces.slice(0, remainingAds);
      
      limitedSpaces.forEach(space => {
        adsPlaced += adPlacer.insertAdInWhitespace(space);
      });
    }
    
    console.log(`Total ads placed on page: ${adsPlaced}`);
    return adsPlaced;
  }
  
  // Event listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Place initial ads
    placeAdsOnPage();
  });
  
  window.addEventListener('load', () => {
    // Add a slight delay to allow for dynamic content to render
    setTimeout(() => {
      placeAdsOnPage();
    }, 1000);
  });
  
  // Handle window resize
  window.addEventListener('resize', debounce(() => {
    // Remove existing ads
    document.querySelectorAll('.extension-added-ad').forEach(el => el.remove());
    
    // Place new ads
    placeAdsOnPage();
  }, 500));
  
  // Handle scroll events
  window.addEventListener('scroll', debounce(() => {
    const currentScrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    
    // Only check for new places if we've scrolled to new territory
    if (currentScrollY + viewportHeight > processedPageHeight) {
      console.log("Checking for new ad placements after scrolling...");
      
      // Update how far we've processed
      processedPageHeight = currentScrollY + viewportHeight;
      
      // Place additional ads (with a lower limit for scrolled content)
      placeAdsOnPage({
        maxTotalAds: config.adPlacementOptions.scrolledContentMaxTotal,
        maxFixedAds: config.adPlacementOptions.scrolledContentMaxFixed
      });
    }
  }, 500));