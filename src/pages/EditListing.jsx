import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.config'
import { useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner'
import { toast } from 'react-toastify'
import { v4 as uuidv4 } from 'uuid'

function EditListing() {
    // eslint-disable-next-line no-unused-vars
    const [geolocationEnabled, setGeolocationEnabled] = useState(true)
    const [loading, setLoading] = useState(false)
    const [listing, setListing] = useState(false)
    const [formData, setFormData] = useState({
        type: 'rent',
        name: '',
        bedrooms: 1,
        bathrooms: 1,
        parking: false,
        furnished: false,
        address: '',
        offer: false,
        regularPrice: 0,
        discountedPrice: 0,
        images: {},
        latitude: 0,
        longitude: 0
    })

    const { type, name, bedrooms, bathrooms, parking, furnished, address, offer, regularPrice, discountedPrice, images, latitude, longitude } = formData

    const auth = getAuth()
    const navigate = useNavigate()
    const params = useParams()
    const isMounted = useRef(true)

    // Sets userRef to logged in user
    useEffect(() => {
        if (isMounted) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    setFormData({...formData, userRef: user.uid})
                } else {
                    navigate('/sign-in')
                }
            })
        }

        return () => {
            isMounted.current = false
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])

    // Redirect if listing is not user's
    useEffect(() => {
        if (listing && listing.userRef !== auth.currentUser.uid) {
            toast.error('You cannot edit that listing')
            navigate('/')
        }
    },[navigate, listing, auth.currentUser.uid])

    // Fetch listing to edit
    useEffect(() => {
        setLoading(true)
        const fetchListing = async () => {
            const docRef = doc(db, 'listings', params.listingId)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
                setListing(docSnap.data())
                setFormData({...docSnap.data(), address: docSnap.data().location})
                setLoading(false)
            } else {
                navigate('/')
                toast.error('Listing does not exist')
            }
        }

        fetchListing()
    },[navigate, params.listingId])

    const onSubmit = async (e) => {
        e.preventDefault()

        setLoading(true)
        
        if (discountedPrice >= regularPrice) {
            setLoading(false)
            toast.error('Discounted price needs to be less than regular price')
            return
        } 

        if (images.length > 6) {
            setLoading(false)
            toast.error('Max 6 images')
            return
        }

        let geolocation = {}
        let location

        if (geolocationEnabled) {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`)

            const data = await response.json()

            geolocation.lat = data.results[0]?.geometry.location.lat ?? 0
            geolocation.lng = data.results[0]?.geometry.location.lng ?? 0

            location = data.status ===  "ZERO_RESULTS" ? undefined : data.results[0]?.formatted_address

            if (location === undefined || location.includes('undefined')) {
                setLoading(false)
                toast.error('Please enter a valid address')
                return
            }
        } else {
            geolocation.lat = latitude
            geolocation.lng = longitude
        }

        // Store images in firebase
        const storeImage = async (image) => {
            return new Promise((resolve, reject) => {
                const storage = getStorage()
                const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`

                const storageRef = ref(storage, 'images/' + fileName)

                const uploadTask = uploadBytesResumable(storageRef, image)

                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log('Upload is ' + progress + '% done');
                        // eslint-disable-next-line default-case
                        switch (snapshot.state) {
                            case 'paused':
                                console.log('Upload is paused');
                                break;
                            case 'running':
                                console.log('Upload is running');
                                break;
                            default:
                                break;
                            }
                    }, 
                    (error) => {
                        reject(error)
                    }, 
                    () => {
                        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                            resolve(downloadURL);
                        });
                    }
                )
            })
        }

        const imageUrls = await Promise.all(
            [...images].map((image) => storeImage(image))
        ).catch(() => {
            setLoading(false)
            toast.error('Images failed to upload')
            return
        })

        const formDataCopy = {
            ...formData,
            imageUrls,
            geolocation,
            timestamp: serverTimestamp()
        }

        formDataCopy.location = address
        delete formDataCopy.images 
        delete formDataCopy.address
        !formDataCopy.offer && delete formDataCopy.discountedPrice

        // Update listing
        const docRef = doc(db, 'listings', params.listingId)
        await updateDoc(docRef, formDataCopy)
        setLoading(false)
        toast.success('Listing saved')
        navigate(`/category/${formDataCopy.type}/${docRef.id}`)
    }

    const onMutate = (e) => {
        let boolean = null

        if (e.target.value === 'true') {
            boolean = true
        }

        if (e.target.value === 'false') {
            boolean = false
        }

        // Files
        if (e.target.files) {
            setFormData((prev) => ({
                ...prev,
                images: e.target.files
            }))
        }

        // Text/Booleans/Numbers
        if (!e.target.files) {
            setFormData((prev) => ({
                ...prev,
                [e.target.id]: boolean ?? e.target.value
            }))
        }
    }

    if (loading) {
        return <Spinner />
    }

  return (
    <div className="profile">
      <header>
        <p className="pageHeader">Edit Listing</p>
      </header>

      <main>
        <form onSubmit={onSubmit}>
            <label className="formLabel">Sell / Rent</label>
            <div className="formButtons">
                <button 
                    type="button" 
                    className={type === 'sale' ? "formButtonActive" : "formButton"} 
                    id="type" 
                    value="sale" 
                    onClick={onMutate} 
                >
                    Sell
                </button>
                <button 
                    type="button" 
                    className={type === 'rent' ? "formButtonActive" : "formButton"} 
                    id="type" 
                    value="rent" 
                    onClick={onMutate} 
                >
                    Rent
                </button>
            </div>

            <label className="formLabel">Name</label>
            <input 
                type="text" 
                id="name"
                value={name} 
                onChange={onMutate} 
                className="formInputName" 
                maxLength="32" 
                minLength="10" 
                required 
            />

            <div className="formRooms flex">
                <div>
                    <label className="formLabel">Bedrooms</label>
                    <input 
                        type="number" 
                        value={bedrooms} 
                        id="bedrooms" 
                        className="formInputSmall" 
                        onChange={onMutate} 
                        min="1" 
                        max="50" 
                        required 
                    />
                </div>
                <div>
                    <label className="formLabel">Bathrooms</label>
                    <input 
                        type="number" 
                        value={bathrooms} 
                        id="bathrooms" 
                        className="formInputSmall" 
                        onChange={onMutate} 
                        min="1" 
                        max="50" 
                        required 
                    />
                </div>
            </div>

            <label className="formLabel">Parking spot</label>
            <div className="formButtons">
                <button 
                    className={parking ? 'formButtonActive' : 'formButton'} 
                    type="button" 
                    id="parking" 
                    value={true} 
                    onClick={onMutate} 
                    min="1" 
                    max="50" 
                >
                    Yes
                </button>
                <button 
                    className={!parking && parking  !== null ? 'formButtonActive' : 'formButton'} 
                    type="button" 
                    id="parking" 
                    value={false} 
                    onClick={onMutate} 
                >
                    No
                </button>
            </div>

            <label className="formLabel">Furnished</label>
            <div className="formButtons">
                <button 
                    className={furnished ? 'formButtonActive' : 'formButton'} 
                    type="button" 
                    id="furnished" 
                    value={true} 
                    onClick={onMutate} 
                    min="1" 
                    max="50" 
                >
                    Yes
                </button>
                <button 
                    className={!furnished && furnished  !== null ? 'formButtonActive' : 'formButton'} 
                    type="button" 
                    id="furnished" 
                    value={false} 
                    onClick={onMutate} 
                >
                    No
                </button>
            </div>

            <label className="formLabel">Address</label>
            <textarea 
                id="address" 
                type="text" 
                value={address} 
                className="formInputAddress" 
                onChange={onMutate} 
                required 
            />

            {!geolocationEnabled && (
                <div className="formLatLng flex">
                    <div>
                        <label className="formLabel">Latitude</label>
                        <input 
                            type="number" 
                            value={latitude} 
                            id="latitude" 
                            className="formInputSmall" 
                            onChange={onMutate} 
                            required 
                        />
                    </div>
                    <div>
                        <label className="formLabel">Longitude</label>
                        <input 
                            type="number" 
                            value={longitude} 
                            id="longitude" 
                            className="formInputSmall" 
                            onChange={onMutate} 
                            required 
                        />
                    </div>
                </div>
            )}

            <label className="formLabel">Offer</label>
            <div className="formButtons">
                <button 
                    type="button" 
                    className={offer ? "formButtonActive" : "formButton"} 
                    id="offer" 
                    value={true} 
                    onClick={onMutate}
                >
                    Yes
                </button>
                <button 
                    type="button" 
                    className={!offer && offer !== null ? "formButtonActive" : "formButton"} 
                    id="offer" 
                    value={false} 
                    onClick={onMutate}
                >
                    No
                </button>
            </div>

            <label className="formLabel">Regular Price</label>
            <div className="formPriceDiv">
                <input 
                    type="number" 
                    id="regularPrice" 
                    value={regularPrice} 
                    className="formInputSmall" 
                    onChange={onMutate} 
                    min="50" 
                    max="750000000" 
                    required 
                />
                {type  === 'rent' && <p className="formPriceText">$ / month</p> }
            </div>

            {offer && (
                <>
                    <label className="formLabel">Discounted Price</label>
                    <div className="formPriceDiv">
                        <input 
                            type="number" 
                            id="discountedPrice" 
                            value={discountedPrice} 
                            onChange={onMutate} 
                            className="formInputSmall" 
                            min="50" 
                            max="750000000" 
                            required={offer} 
                        />
                        {type  === 'rent' && <p className="formPriceText">$ / month</p> }
                    </div>
                </>
            )}

            <label className="formLabel">Images</label>
            <p className="imagesInfo">The first image will be the cover (max 6).</p>
            <input 
                type="file" 
                id="images" 
                onChange={onMutate} 
                className="formInputFile" 
                max="6" 
                accept=".jpg,.png,.jpeg" 
                multiple 
                required 
            />
            <button type="submit" className="primaryButton createListingButton">
                Update Listing
            </button>
        </form>
      </main>
    </div>
  )
}

export default EditListing
