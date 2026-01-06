import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, getCountFromServer, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;

console.log("Script loaded - v3 (Base64 Mode)");

// --- Global Auth Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.email);
        currentUser = user;
        updateNav(user);
        
        // Initialize page-specific logic
        initDashboard(user);
        initLibrary(user);
    } else {
        console.log("No user logged in");
        // Redirect to login if not on public pages
        const path = window.location.pathname;
        if (!path.includes('login.html') && !path.includes('signup.html') && !path.includes('index.html') && path !== '/' && !path.endsWith('JAVA%20PROJECT-BOOKSWAP/')) {
            window.location.href = 'login.html';
        }
    }
});

// --- Logout Handler ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'index.html');
    });
}

// --- Navigation UI ---
function updateNav(user) {
    const welcomeMsg = document.getElementById('welcomeMsg');
    if (welcomeMsg) {
        welcomeMsg.textContent = `Hi, ${user.displayName || 'User'}`;
    }
}

// --- Dashboard Logic ---
async function initDashboard(user) {
    const bookCountEl = document.getElementById('bookCount');
    
    if (bookCountEl) {
        try {
            const q = query(collection(db, "books"), where("ownerId", "==", user.uid));
            const snapshot = await getCountFromServer(q);
            bookCountEl.textContent = snapshot.data().count;
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
            bookCountEl.textContent = "-";
        }
    }

    // Add "Update Address" button to Dashboard
    const actionGrid = document.querySelector('.action-grid');
    if (actionGrid && !document.getElementById('addrBtn')) {
        const btn = document.createElement('div');
        btn.className = 'action-card';
        btn.id = 'addrBtn';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<i class="ri-map-pin-user-line"></i> Update Address`;
        btn.onclick = window.updateAddress;
        actionGrid.appendChild(btn);
    }
}

// --- Library Logic ---
function initLibrary(user) {
    const addBookForm = document.getElementById('addBookForm');
    const booksGrid = document.getElementById('booksGrid');

    // 1. Handle Add Book
    if (addBookForm) {
        // Use a flag to prevent duplicate listeners instead of cloning
        if (!addBookForm.dataset.listenerAttached) {
            addBookForm.addEventListener('submit', (e) => handleAddBook(e, user));
            addBookForm.dataset.listenerAttached = "true";
        }
    }

    // 2. Load Books Real-time
    if (booksGrid) {
        console.log("Initializing library grid...");
        const q = query(collection(db, "books"), where("ownerId", "==", user.uid));
        
        onSnapshot(q, (snapshot) => {
            booksGrid.innerHTML = '';
            if (snapshot.empty) {
                booksGrid.innerHTML = '<p>No books in your library yet.</p>';
                return;
            }
            
            snapshot.forEach((doc) => {
                const book = doc.data();
                const bookCard = document.createElement('div');
                bookCard.className = 'book-card';
                bookCard.innerHTML = `
                    <img src="${book.imageURL}" alt="${book.title}">
                    <div class="book-info">
                        <h3>${book.title}</h3>
                        <p>by ${book.author}</p>
                        <span class="badge">${book.status || 'available'}</span>
                        <div class="book-actions">
                            <button class="edit-btn" onclick="window.editBook('${doc.id}')">Edit</button>
                            <button class="delete-btn" onclick="window.deleteBook('${doc.id}')">Delete</button>
                        </div>
                    </div>
                `;
                booksGrid.appendChild(bookCard);
            });
        }, (error) => {
            console.error("Error loading books:", error);
            booksGrid.innerHTML = `<p style="color:red">Error loading books: ${error.message}</p>`;
        });
    }
}

// --- Global Library Actions (Edit/Delete) ---
window.updateAddress = async () => {
    if (!currentUser) return;
    const newAddr = prompt("Please enter your shipping address (for book swaps):");
    if (newAddr && newAddr.trim() !== "") {
        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                address: newAddr,
                email: currentUser.email,
                displayName: currentUser.displayName || "User"
            }, { merge: true });
            alert("Address updated successfully!");
        } catch (e) {
            console.error("Error saving address:", e);
            alert("Failed to save address.");
        }
    }
};

window.deleteBook = async (id) => {
    if(confirm("Are you sure you want to delete this book? This cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "books", id));
            // UI updates automatically via onSnapshot
        } catch(e) {
            console.error(e);
            alert("Error deleting book: " + e.message);
        }
    }
};

window.editBook = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "books", id));
        if(docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('bookTitle').value = data.title;
            document.getElementById('bookAuthor').value = data.author;
            document.getElementById('bookGenre').value = data.genre;
            document.getElementById('bookCondition').value = data.condition;
            
            const form = document.getElementById('addBookForm');
            form.dataset.editId = id;
            form.dataset.currentImage = data.imageURL;
            
            const btn = document.getElementById('addBtn');
            btn.textContent = "Update Book";
            
            document.querySelector('.add-book-section').scrollIntoView({behavior: 'smooth'});
        }
    } catch(e) {
        console.error(e);
        alert("Error loading book details.");
    }
};

async function handleAddBook(event, user) {
    event.preventDefault();
    console.log("Starting book upload...");
    
    const btn = document.getElementById('addBtn');
    const originalText = btn.textContent;
    const form = document.getElementById('addBookForm');
    const editId = form.dataset.editId;
    const currentImage = form.dataset.currentImage;
    
    // Get Values
    const title = document.getElementById('bookTitle').value;
    const author = document.getElementById('bookAuthor').value;
    const genre = document.getElementById('bookGenre').value;
    const condition = document.getElementById('bookCondition').value;
    const file = document.getElementById('bookImage').files[0];

    if (!file && !editId) {
        alert("Please select an image.");
        return;
    }

    try {
        btn.textContent = editId ? "Updating..." : "Uploading...";
        btn.disabled = true;

        // 1. Check File Size (Firestore limit is 1MB, so we limit image to ~700KB)
        if (file && file.size > 700 * 1024) {
            throw new Error("Image too large. Please select an image under 700KB.");
        }

        // 2. Convert Image to Base64 (No Storage Bucket needed)
        const convertToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
            });
        };
        
        let downloadURL = currentImage;
        if (file) {
            downloadURL = await convertToBase64(file);
        }

        if (editId) {
            // Update existing book
            await updateDoc(doc(db, "books", editId), {
                title, author, genre, condition, imageURL: downloadURL
            });
            alert("Book updated successfully!");
            
            // Reset Edit Mode
            delete form.dataset.editId;
            delete form.dataset.currentImage;
            btn.textContent = "Add to Library";
        } else {
            // Create new book
            await addDoc(collection(db, "books"), {
                title: title,
                author: author,
                genre: genre,
                condition: condition,
                imageURL: downloadURL,
                ownerId: user.uid,
                ownerName: user.displayName || "Anonymous",
                status: "available",
                createdAt: serverTimestamp()
            });
            alert("Book added successfully!");
        }

        form.reset();

    } catch (error) {
        console.error("Error adding book:", error);
        alert("Failed to add book: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}