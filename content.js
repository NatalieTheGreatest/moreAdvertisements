let processedPageHeight = window.innerHeight;

  
const adImages = ['images/add1.png', 'images/add2.png', 'images/add3.png']; // These are all stolen images from walmart.com
const adLink = 'https://www.walmart.com/'; // Send them to the home page

  

  //region event listeners


  document.addEventListener('DOMContentLoaded', () => {
    // Place initial ads
    placeAdsOnPage({
      maxTotalAds: 5,
      maxFixedAds: 1,
      adImages: adImages,
      adLink: adLink
    });
  });


  window.addEventListener('load', () => {
    // Add a slight delay to allow for dynamic content to render
    setTimeout(() => {
        placeAdsOnPage({
            maxTotalAds: 5,
            maxFixedAds: 1,
            adImages: adImages,
            adLink: adLink
          });
    }, 1000);
  });


  // We must be responsive
  window.addEventListener('resize', debounce(() => {
    // Remove existing ads
    document.querySelectorAll('.extension-added-ad').forEach(el => el.remove());
    
    // Find new whitespaces and insert ads
    const whitespaces = findWhiteSpaces();
    whitespaces.forEach(space => {
      insertAd(space);
    });
  }, 500));
  

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
      maxTotalAds: 2, // Fewer ads for newly scrolled content
      maxFixedAds: 0, // No new fixed ads on scroll
      adImages: adImages,
      adLink: adLink
    });
  }
}, 500));

  
  //endregion
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
  
  function findEmptySpaces() {
    console.log("Finding empty spaces...");
    const emptySpaces = findWhiteSpaces();
    console.log(`Found ${emptySpaces.length} empty spaces:`, emptySpaces);
    // For each empty space, insert an ad
    emptySpaces.forEach(space => {
      insertAd(space);
    });
  }

  // Modified whitespace finder that only looks in a specific vertical range
  function findWhiteSpacesInRange(startY, endY) {
    const whiteSpaces = [];
    const elements = document.elementsFromPoint(window.innerWidth / 2, endY - 10);

    console.log(`Scanning range from ${startY} to ${endY}`);
    
    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        console.log(`Checking element:`, el.tagName, `at Y position`, rect.top);
        
        if (rect.top >= startY && rect.bottom <= endY) {
            // Adjust condition to catch areas with less content
            if (el.innerText.trim() === "" && el.children.length === 0) {
                whiteSpaces.push({
                    top: rect.top + window.scrollY,
                    bottom: rect.bottom + window.scrollY
                });
            }
        }
    });

    console.log(`Found ${whiteSpaces.length} white spaces.`);
    return whiteSpaces;
}

// For div related strategy

// Enhanced function to find divs for ad placement
function findDivsForAds(options = {}) {
    const {
        paddingThreshold = 50,
        minDivHeight = 200,  
        maxAdsPerPage = 5,
        prioritizeVisible = true
    } = options;
    
    const divs = document.querySelectorAll("div");
    const validDivs = [];
    
    divs.forEach(div => {
        // Skip tiny divs
        if (div.offsetWidth < 200 || div.offsetHeight < minDivHeight) return;
        
        // Skip divs with extension ads already
        if (div.querySelector('.extension-added-ad')) return;
        
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
        
        // Consider various placement criteria
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
        
        // Calculate visibility score (prioritize divs in viewport)
        let visibilityScore = 0;
        if (prioritizeVisible) {
            const viewportHeight = window.innerHeight;
            if (rect.top >= 0 && rect.bottom <= viewportHeight) {
                // Fully visible
                visibilityScore = 3;
            } else if (rect.top < viewportHeight && rect.bottom > 0) {
                // Partially visible
                visibilityScore = 2;
            } else if (rect.top > 0 && rect.top < viewportHeight * 2) {
                // Just below viewport
                visibilityScore = 1;
            }
        }
        
        // Calculate placement score (higher score = better placement candidate)
        let placementScore = 0;
        if (hasPadding) placementScore += 2;
        if (hasMargin) placementScore += 1;
        if (hasBackground) placementScore += 1;
        if (div.children.length > 0) placementScore += 1; // Non-empty divs are good targets
        if (rect.width > 400) placementScore += 2; // Wider divs are better
        
        // Total score combines visibility and placement potential
        const totalScore = visibilityScore * 3 + placementScore;
        
        validDivs.push({
            element: div,
            rect,
            score: totalScore,
            isInViewport: visibilityScore > 1
        });
    });
    
    // Sort by score (higher first) and limit to max ads
    return validDivs
        .sort((a, b) => b.score - a.score)
        .slice(0, maxAdsPerPage);
}

// Insert ads into the divs with better positioning
function insertAdsInDivs(divData, adImageArray, linkUrl) {
    console.log(`Starting to insert ads in ${divData.length} selected divs`);
    
    let adCount = 0;
    
    divData.forEach(({ element, rect, isInViewport }) => {
        // Calculate ad position
        // For viewport divs, try to place near top
        // For below-viewport divs, place relative to div size
        
        // Create ad container
        const adContainer = document.createElement('div');
        adContainer.className = 'extension-added-ad';
        
        // Size adapt to div width
        const adWidth = Math.min(300, rect.width * 0.8);
        const adHeight = Math.min(250, adWidth * 0.75);
        
        adContainer.style.width = `${adWidth}px`;
        adContainer.style.height = `${adHeight}px`;
        adContainer.style.position = 'absolute';
        
        // Position the ad
        if (isInViewport) {
            // For visible divs, place at top area
            adContainer.style.top = '10px';
        } else {
            // For divs not in viewport, vary position
            const positionVariant = adCount % 3;
            if (positionVariant === 0) {
                // Top of div
                adContainer.style.top = '10px';
            } else if (positionVariant === 1) {
                // Middle of div
                adContainer.style.top = `${(rect.height - adHeight) / 2}px`;
            } else {
                // Bottom of div
                adContainer.style.bottom = '10px';
            }
        }
        
        // Alternate between left, center, right positioning
        const horizontalPosition = adCount % 3;
        if (horizontalPosition === 0) {
            adContainer.style.left = '10px';
        } else if (horizontalPosition === 1) {
            adContainer.style.left = `${(rect.width - adWidth) / 2}px`;
        } else {
            adContainer.style.right = '10px';
        }
        
        // Add styling
        adContainer.style.zIndex = '1000';
        adContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        adContainer.style.backgroundColor = '#fff';
        adContainer.style.border = '1px solid #ddd';
        adContainer.style.borderRadius = '3px';
        
        // Create link element
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        
        // Create image element
        const img = document.createElement('img');
        const randomIndex = Math.floor(Math.random() * adImageArray.length);
        img.src = chrome.runtime.getURL(adImageArray[randomIndex]);
        
        img.onerror = () => {
            console.error("Failed to load image:", img.src);
            // Try a different image
            const newIndex = (randomIndex + 1) % adImageArray.length;
            img.src = chrome.runtime.getURL(adImageArray[newIndex]);
        };
        
        img.onload = () => {
            console.log("Successfully loaded image:", img.src);
        };
        
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        // Assemble elements
        link.appendChild(img);
        adContainer.appendChild(link);
        
        // Make sure parent can handle absolute positioning
        const originalPosition = window.getComputedStyle(element).position;
        if (originalPosition === 'static') {
            element.style.position = 'relative';
        }
        
        // Add close button
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
            adContainer.remove();
        });
        
        adContainer.appendChild(closeBtn);
        
        // Add to DOM
        element.appendChild(adContainer);
        adCount++;
        
        console.log(`Ad inserted in div at position (${rect.left}, ${rect.top}), viewport visible: ${isInViewport}`);
    });
    
    console.log(`Successfully placed ${adCount} ads in divs`);
    return adCount;
}

// Additional function for placing ads in strategic fixed positions
function placeFixedPositionAds(adImageArray, linkUrl, maxAds = 2) {
    console.log("Placing fixed position ads");
    
    const placementSpots = [
        // Right side banner
        {
            position: 'fixed',
            right: '10px',
            top: '100px',
            width: '160px',
            height: '600px',
            zIndex: 1000
        },
        // Top banner
        {
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '728px',
            height: '90px',
            zIndex: 1000
        },
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
    
    // Check if we already have fixed position ads
    const existingAds = document.querySelectorAll('.extension-fixed-ad');
    if (existingAds.length >= maxAds) {
        console.log(`Already have ${existingAds.length} fixed ads, skipping`);
        return 0;
    }
    
    // Calculate how many more we need
    const adsToPlace = Math.min(maxAds - existingAds.length, placementSpots.length);
    let adCount = 0;
    
    // Place new ads
    for (let i = 0; i < adsToPlace; i++) {
        const spotConfig = placementSpots[i];
        
        // Create ad container
        const adContainer = document.createElement('div');
        adContainer.className = 'extension-added-ad extension-fixed-ad';
        
        // Apply position styling
        Object.keys(spotConfig).forEach(key => {
            adContainer.style[key] = spotConfig[key];
        });
        
        // Create link element
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        
        // Create image element
        const img = document.createElement('img');
        const randomIndex = Math.floor(Math.random() * adImageArray.length);
        img.src = chrome.runtime.getURL(adImageArray[randomIndex]);
        
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        // Assemble the ad
        link.appendChild(img);
        adContainer.appendChild(link);
        
        // Add close button
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
            adContainer.remove();
        });
        
        adContainer.appendChild(closeBtn);
        
        // Add to DOM
        document.body.appendChild(adContainer);
        adCount++;
    }
    
    console.log(`Placed ${adCount} fixed position ads`);
    return adCount;
}

// Master function to coordinate all ad placement strategies
function placeAdsOnPage(options = {}) {
    const {
        maxTotalAds = 5, 
        maxFixedAds = 1,
        adImages = ['images/add1.png', 'images/add2.png', 'images/add3.png'],
        adLink = 'https://www.walmart.com/'
    } = options;
    
    console.log("Starting ad placement with max total:", maxTotalAds);
    let adsPlaced = 0;
    
    // 1. First try div-based placement (prioritize these)
    const divTargets = findDivsForAds({
        paddingThreshold: 50,
        minDivHeight: 150,
        maxAdsPerPage: maxTotalAds - adsPlaced,
        prioritizeVisible: true
    });
    
    adsPlaced += insertAdsInDivs(divTargets, adImages, adLink);
    console.log(`Total ads placed after div insertion: ${adsPlaced}`);
    
    // 2. If we still need more ads, try fixed positions
    if (adsPlaced < maxTotalAds) {
        adsPlaced += placeFixedPositionAds(
            adImages, 
            adLink, 
            Math.min(maxFixedAds, maxTotalAds - adsPlaced)
        );
    }
    
    // 3. If still under limit, use the original whitespace detection as fallback
    if (adsPlaced < maxTotalAds) {
        const remainingAds = maxTotalAds - adsPlaced;
        console.log(`Still need ${remainingAds} ads, using whitespace detection`);
        
        // Using your existing functions here...
        const whitespaces = findWhiteSpaces();
        const limitedSpaces = whitespaces.slice(0, remainingAds);
        
        limitedSpaces.forEach(space => {
            insertAd(space);
            adsPlaced++;
        });
    }
    
    console.log(`Total ads placed on page: ${adsPlaced}`);
    return adsPlaced;
}



  // Modified grid-based whitespace detection that looks only in a specific vertical range
function findWhiteSpacesGridInRange(topBound, bottomBound) {
    const whitespaces = [];
    const gridSize = 50; // Size of each grid cell in pixels
    const minAdSize = 100; // Minimum size for an ad to be worth placing
    
    // Create a grid representing only the viewport range we're interested in
    const viewportWidth = window.innerWidth;
    const rangeHeight = bottomBound - topBound;
    
    // Convert bounds to grid coordinates
    const startRow = Math.floor(topBound / gridSize);
    const endRow = Math.ceil(bottomBound / gridSize);
    const numRows = endRow - startRow;
    
    // Create a 2D array to track occupied spaces
    const grid = Array(numRows).fill()
      .map(() => Array(Math.ceil(viewportWidth / gridSize)).fill(false));
    
    // Mark grid cells that contain DOM elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      if (element.className === 'extension-added-ad') return; // Skip our own ads
      
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // Skip invisible elements
      
      // Convert viewport coordinates to page coordinates
      const absoluteTop = rect.top + window.scrollY;
      const absoluteBottom = rect.bottom + window.scrollY;
      
      // Skip if element is outside our range
      if (absoluteBottom < topBound || absoluteTop > bottomBound) return;
      
      // Mark cells occupied by this element
      const elementStartRow = Math.max(0, Math.floor((absoluteTop - topBound) / gridSize));
      const elementEndRow = Math.min(numRows - 1, Math.ceil((absoluteBottom - topBound) / gridSize));
      const startCol = Math.max(0, Math.floor(rect.left / gridSize));
      const endCol = Math.min(grid[0].length - 1, Math.ceil(rect.right / gridSize));
      
      for (let row = elementStartRow; row <= elementEndRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          if (row >= 0 && row < grid.length) {
            grid[row][col] = true;
          }
        }
      }
    });
    
    // Find contiguous empty regions (similar to your original code)
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col]) continue; // Skip occupied cells
        
        // Expand to find the largest empty rectangle starting at this cell
        let width = 1;
        let height = 1;
        
        // Expand horizontally
        while (col + width < grid[0].length && !grid[row][col + width]) {
          width++;
        }
        
        // Expand vertically
        let canExpandVertically = true;
        while (canExpandVertically && row + height < grid.length) {
          for (let c = col; c < col + width; c++) {
            if (grid[row + height][c]) {
              canExpandVertically = false;
              break;
            }
          }
          if (canExpandVertically) height++;
        }
        
        // Convert back to pixel dimensions and adjust for the range offset
        const pixelWidth = width * gridSize;
        const pixelHeight = height * gridSize;
        
        // Only add if space is large enough
        if (pixelWidth >= minAdSize && pixelHeight >= minAdSize) {
          whitespaces.push({
            left: col * gridSize,
            top: (row + startRow) * gridSize, // Adjust back to page coordinates
            width: pixelWidth,
            height: pixelHeight
          });
          
          // Mark this area as occupied to avoid overlapping ads
          for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
              if (r < grid.length) {
                grid[r][c] = true;
              }
            }
          }
        }
      }
    }
    
    return whitespaces;
  }
  
  // Modified margin analysis for the specified range
  function findWhiteSpacesMarginsInRange(topBound, bottomBound) {
    const whitespaces = [];
    const elements = document.querySelectorAll('body > *');
    const minMargin = 40; // Minimum margin size to consider
    
    elements.forEach(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Convert viewport coordinates to page coordinates
      const absoluteTop = rect.top + window.scrollY;
      const absoluteBottom = rect.bottom + window.scrollY;
      
      // Skip if element is outside our range
      if (absoluteBottom < topBound || absoluteTop > bottomBound) return;
      
      // Check right margin
      const rightMargin = parseInt(style.marginRight);
      if (rightMargin >= minMargin) {
        whitespaces.push({
          left: rect.right,
          top: absoluteTop,
          width: rightMargin,
          height: rect.height
        });
      }
      
      // Check bottom margin
      const bottomMargin = parseInt(style.marginBottom);
      if (bottomMargin >= minMargin) {
        whitespaces.push({
          left: rect.left,
          top: absoluteBottom,
          width: rect.width,
          height: bottomMargin
        });
      }
    });
    
    return whitespaces;
  }


// Strategy 1: Grid-based approach
function findWhiteSpacesGrid() {
    const whitespaces = [];
    const gridSize = 25; // Size of each grid cell in pixels
    const minAdSize = 50; // Minimum size for an ad to be worth placing
    
    // Create a grid representing the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Create a 2D array to track occupied spaces
    const grid = Array(Math.ceil(viewportHeight / gridSize)).fill()
      .map(() => Array(Math.ceil(viewportWidth / gridSize)).fill(false));
    
    // Mark grid cells that contain DOM elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      if (element.className === 'extension-added-ad') return; // Skip our own ads
      
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // Skip invisible elements
      
      // Mark cells occupied by this element
      const startRow = Math.max(0, Math.floor(rect.top / gridSize));
      const endRow = Math.min(grid.length - 1, Math.ceil(rect.bottom / gridSize));
      const startCol = Math.max(0, Math.floor(rect.left / gridSize));
      const endCol = Math.min(grid[0].length - 1, Math.ceil(rect.right / gridSize));
      
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          grid[row][col] = true;
        }
      }
    });
    
    // Find contiguous empty regions
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col]) continue; // Skip occupied cells
        
        // Expand to find the largest empty rectangle starting at this cell
        let width = 1;
        let height = 1;
        
        // Expand horizontally
        while (col + width < grid[0].length && !grid[row][col + width]) {
          width++;
        }
        
        // Expand vertically
        let canExpandVertically = true;
        while (canExpandVertically && row + height < grid.length) {
          for (let c = col; c < col + width; c++) {
            if (grid[row + height][c]) {
              canExpandVertically = false;
              break;
            }
          }
          if (canExpandVertically) height++;
        }
        
        // Convert back to pixel dimensions
        const pixelWidth = width * gridSize;
        const pixelHeight = height * gridSize;
        
        // Only add if space is large enough
        if (pixelWidth >= minAdSize && pixelHeight >= minAdSize) {
          whitespaces.push({
            left: col * gridSize,
            top: row * gridSize,
            width: pixelWidth,
            height: pixelHeight
          });
          
          // Mark this area as occupied to avoid overlapping ads
          for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
              grid[r][c] = true;
            }
          }
        }
      }
    }
    
    return whitespaces;
  }
  
  // Strategy 2: Margin/Padding analysis
  function findWhiteSpacesMargins() {
    const whitespaces = [];
    const elements = document.querySelectorAll('body > *');
    const minMargin = 40; // Minimum margin size to consider
    
    elements.forEach(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Check right margin
      const rightMargin = parseInt(style.marginRight);
      if (rightMargin >= minMargin) {
        whitespaces.push({
          left: rect.right,
          top: rect.top,
          width: rightMargin,
          height: rect.height
        });
      }
      
      // Check bottom margin
      const bottomMargin = parseInt(style.marginBottom);
      if (bottomMargin >= minMargin) {
        whitespaces.push({
          left: rect.left,
          top: rect.bottom,
          width: rect.width,
          height: bottomMargin
        });
      }
    });
    
    return whitespaces;
  }
  
  // Strategy 3: Fixed positions - place ads in common whitespace areas
  function findFixedPositionWhitespaces() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const whitespaces = [];
    
    // Common places for whitespace:
    
    // 1. Right sidebar
    const rightSidebarWidth = Math.min(300, viewportWidth * 0.2);
    if (viewportWidth > 1200) { // Only on wider screens
      whitespaces.push({
        left: viewportWidth - rightSidebarWidth - 20,
        top: 100,
        width: rightSidebarWidth,
        height: viewportHeight - 200
      });
    }
    
    // 2. Between major content sections (need to adjust based on actual page analysis)
    // This would require identifying major content sections
    
    // 3. Footer area
    whitespaces.push({
      left: 50,
      top: viewportHeight - 150,
      width: viewportWidth - 100,
      height: 100
    });
    
    return whitespaces;
  }
  
  // Ensure they are not too large
  function subdivideSpaces(spaces) {
    const maxWidth = 300; // Maximum width for an ad
    const maxHeight = 250; // Maximum height for an ad
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
  }

  function findWhiteSpaces() {
    // Try grid-based detection first
    let spaces = findWhiteSpacesGrid();
    
    // If grid method didn't find enough spaces, try margin analysis
    if (spaces.length < 2) {
      console.log("Trying to find margin")
      spaces = spaces.concat(findWhiteSpacesMargins());
    }
    
    // If we still need more ad spaces, use fixed positions
    if (spaces.length < 3) {
       console.log("Trying to find fixed position")
      spaces = spaces.concat(findFixedPositionWhitespaces());
    }
    
    // Filter out overlapping spaces
    spaces = filterOverlappingSpaces(spaces);
    
    // Break up large spaces into smaller ones
    spaces = subdivideSpaces(spaces);
    
    console.log("Final ad spaces:", spaces);
    return spaces;
  }
  
  // Helper function to remove overlapping whitespaces
  function filterOverlappingSpaces(spaces) {
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


  function insertAd(space) {
    // Create container for the ad
    const adContainer = document.createElement('div');
    adContainer.className = 'extension-added-ad';
    adContainer.style.width = space.width + 'px';
    adContainer.style.height = space.height + 'px';
    adContainer.style.position = 'absolute';
    adContainer.style.left = space.left + 'px';
    adContainer.style.top = space.top + 'px';
    
    // Create link element
    const link = document.createElement('a');
    link.href = adLink;
    link.target = '_blank'; // Open in new tab
    
    // Create image element
    const img = document.createElement('img');
    // Pick a random image from your collection
    const randomIndex = Math.floor(Math.random() * adImages.length);
    // Fix the image path - include the full extension URL
    img.src = chrome.runtime.getURL(adImages[randomIndex]);
    console.log("Trying to load image:", img.src); // Debugging
    img.onerror = () => console.error("Failed to load image:", img.src);
    img.onload = () => console.log("Successfully loaded image:", img.src);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    // Assemble the elements
    link.appendChild(img);
    adContainer.appendChild(link);
    document.querySelector('body').appendChild(adContainer);
}