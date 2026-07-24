import { useState, useEffect, lazy, Suspense } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LocalDbUploader } from "@/components/LocalDbUploader"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/hooks/useTheme"
import { AppHeader } from "@/components/Layout/AppHeader"
import { NavigationTabs } from "@/components/Layout/NavigationTabs"
import { Button } from "@/components/ui/button"
import { Toaster } from "sonner"
import { useRouteMetadata } from "@/hooks/useRouteMetadata"
import { incrementHistoryCount, navigateBack } from "@/lib/utils"
import { OnboardingModal } from "@/components/OnboardingModal"
import { QuotaBanner } from "@/components/QuotaBanner"

// Lazy load heavy components to code-split the application
const AdvancedSearch = lazy(() => import("@/components/AdvancedSearch").then(module => ({ default: module.AdvancedSearch })))
const SqlEditor = lazy(() => import("@/components/SqlEditor").then(module => ({ default: module.SqlEditor })))
const AiAssistant = lazy(() => import("@/components/AiAssistant").then(module => ({ default: module.AiAssistant })))
const PublicationsSearch = lazy(() => import("@/components/Publications/PublicationsSearch").then(module => ({ default: module.PublicationsSearch })))
const Settings = lazy(() => import("@/components/Settings").then(module => ({ default: module.Settings })))
const AuthorsSearch = lazy(() => import("@/components/Authors/AuthorsSearch").then(module => ({ default: module.AuthorsSearch })))
const CharactersSearch = lazy(() => import("@/components/Characters/CharactersSearch").then(module => ({ default: module.CharactersSearch })))
const CountryPublications = lazy(() => import("@/components/Publications/CountryPublications").then(module => ({ default: module.CountryPublications })))
const CountryList = lazy(() => import("@/components/Publications/CountryList").then(module => ({ default: module.CountryList })))
const PublicationDetail = lazy(() => import("@/components/Publications/PublicationDetail").then(module => ({ default: module.PublicationDetail })))
const PublisherDetail = lazy(() => import("@/components/Publications/PublisherDetail").then(module => ({ default: module.PublisherDetail })))
const IssueDetail = lazy(() => import("@/components/Publications/IssueDetail").then(module => ({ default: module.IssueDetail })))

// Reusable loading fallback
const TabFallback = () => (
  <div className="flex w-full h-full min-h-[300px] items-center justify-center text-primary/40">
    <Loader2 className="w-8 h-8 animate-spin" />
  </div>
)

function App() {
  const { i18n, t } = useTranslation();
  useTheme(); // initialise theme from localStorage / system preference
  const [activeTab, setActiveTab] = useState("stories");
  const [prevTab, setPrevTab] = useState("stories");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM inducks_story LIMIT 10");

  const [selectedStorycode, setSelectedStorycode] = useState<string | null>(null);
  const [selectedIssuecode, setSelectedIssuecode] = useState<string | null>(null);
  const [selectedPersoncode, setSelectedPersoncode] = useState<string | null>(null);
  const [selectedCharactercode, setSelectedCharactercode] = useState<string | null>(null);
  const [selectedCountrycode, setSelectedCountrycode] = useState<string | null>(null);
  const [selectedPublicationcode, setSelectedPublicationcode] = useState<string | null>(null);
  const [selectedPublisherid, setSelectedPublisherid] = useState<string | null>(null);

  // Call route metadata hook to update page title and description
  useRouteMetadata({
    activeTab,
    selectedStorycode,
    selectedIssuecode,
    selectedPersoncode,
    selectedCharactercode,
    selectedCountrycode,
    selectedPublicationcode,
  });

  useEffect(() => {
    const handleUrlRouting = () => {
      incrementHistoryCount();
      const hash = window.location.hash;
      
      // Reset all codes
      setSelectedStorycode(null);
      setSelectedIssuecode(null);
      setSelectedPersoncode(null);
      setSelectedCharactercode(null);
      setSelectedCountrycode(null);
      setSelectedPublicationcode(null);

      if (!hash) {
        setActiveTab("stories");
        return;
      }

      const decodedHash = decodeURIComponent(hash);
      const parts = decodedHash.replace("#/", "").split("/");
      const rootPart = parts[0];

      if (rootPart === "settings") {
        setActiveTab("settings");
      } else if (rootPart === "entries" || rootPart === "stories") {
        setActiveTab("stories");
        if (parts[1] === "story" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedStorycode(code);
        } else if (parts[1] === "issue" && parts[2]) {
          const code = parts.slice(2).join("/");
          const partsArr = code.split("/");
          const restoredCode = partsArr.length >= 3 ? `${partsArr[0]}/${partsArr[1]} ${partsArr.slice(2).join("/")}` : code;
          setSelectedIssuecode(restoredCode);
        }
      } else if (rootPart === "publications") {
        setActiveTab("publications");
        setSelectedPublisherid(null);
        if (parts[1] === "publication" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedPublicationcode(code);
        } else if (parts[1] === "story" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedStorycode(code);
        } else if (parts[1] === "issue" && parts[2]) {
          const code = parts.slice(2).join("/");
          const partsArr = code.split("/");
          const restoredCode = partsArr.length >= 3 ? `${partsArr[0]}/${partsArr[1]} ${partsArr.slice(2).join("/")}` : code;
          setSelectedIssuecode(restoredCode);
        }
      } else if (rootPart === "authors") {
        setActiveTab("authors");
        if (parts[1]) setSelectedPersoncode(parts.slice(1).join("/"));
      } else if (rootPart === "characters") {
        setActiveTab("characters");
        if (parts[1]) setSelectedCharactercode(parts.slice(1).join("/"));
      } else if (rootPart === "countries") {
        setActiveTab("countries");
        if (parts[1]) setSelectedCountrycode(parts.slice(1).join("/"));
      } else if (rootPart === "publishers") {
        setActiveTab("publications");
        setSelectedPublicationcode(null);
        setSelectedStorycode(null);
        setSelectedIssuecode(null);
        if (parts[1]) setSelectedPublisherid(parts.slice(1).join("/"));
      } else if (rootPart === "sql") {
        setActiveTab("sql");
      } else {
        setActiveTab("stories");
      }
    };

    handleUrlRouting();
    window.addEventListener("popstate", handleUrlRouting);
    window.addEventListener("hashchange", handleUrlRouting);
    
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleTabChange(customEvent.detail);
      }
    };
    window.addEventListener("switch-tab", handleSwitchTab);
    
    return () => {
      window.removeEventListener("popstate", handleUrlRouting);
      window.removeEventListener("hashchange", handleUrlRouting);
      window.removeEventListener("switch-tab", handleSwitchTab);
    };
  }, []);

  const pushHashState = (expectedHash: string) => {
    // Force the path to be the absolute base path to avoid nested relative paths
    const baseUrl = import.meta.env.BASE_URL || "/";
    const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const expectedUrl = `${cleanBase}${expectedHash}`;
    
    // Compare actual URL (path + hash) to avoid duplicate pushState calls
    const currentUrl = window.location.pathname + window.location.hash;
    if (currentUrl !== expectedUrl) {
      window.history.pushState(null, "", expectedUrl);
    }
  };

  useEffect(() => {
    const rootPrefix = activeTab === "stories" ? "entries" : activeTab;
    
    if (activeTab === "settings") {
      pushHashState("#/settings");
    } else if (selectedStorycode) {
      pushHashState(`#/${rootPrefix}/story/${encodeURI(selectedStorycode)}`);
    } else if (selectedIssuecode) {
      // Replace the space with a slash for cleaner URLs
      const displayCode = selectedIssuecode.replace(" ", "/");
      pushHashState(`#/${rootPrefix}/issue/${encodeURI(displayCode)}`);
    } else if (selectedPersoncode) {
      pushHashState(`#/authors/${encodeURI(selectedPersoncode)}`);
    } else if (selectedCharactercode) {
      pushHashState(`#/characters/${encodeURI(selectedCharactercode)}`);
    } else if (selectedPublisherid) {
      pushHashState(`#/publishers/${encodeURI(selectedPublisherid)}`);
    } else if (selectedCountrycode) {
      pushHashState(`#/countries/${encodeURI(selectedCountrycode)}`);
    } else if (selectedPublicationcode) {
      pushHashState(`#/publications/publication/${encodeURI(selectedPublicationcode)}`);
    } else {
      pushHashState(`#/${rootPrefix}`);
    }
  }, [
    activeTab, 
    selectedStorycode, 
    selectedIssuecode, 
    selectedPersoncode, 
    selectedCharactercode, 
    selectedCountrycode, 
    selectedPublisherid,
    selectedPublicationcode
  ]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedStorycode(null);
    setSelectedIssuecode(null);
    setSelectedPersoncode(null);
    setSelectedCharactercode(null);
    setSelectedCountrycode(null);
    setSelectedPublisherid(null);
    setSelectedPublicationcode(null);
  };

  return (
    <TooltipProvider>
      <GoogleAnalytics activeTab={activeTab} />
      <div id="main-content" className="h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground">
        <div className="flex flex-col h-screen shrink-0">
          {/* Main Header */}
          {/* Main Header */}
          <AppHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            prevTab={prevTab}
            setPrevTab={setPrevTab}
          />

        {/* Global Banner for Turso Quota Errors */}
        <QuotaBanner onGoToSettings={() => setActiveTab("settings")} />

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <NavigationTabs activeTab={activeTab} />

          {/* Content Viewport */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <TabsContent value="stories" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              <Suspense fallback={<TabFallback />}>
                <AdvancedSearch
                  selectedStorycode={selectedStorycode}
                  setSelectedStorycode={setSelectedStorycode}
                  selectedIssuecode={selectedIssuecode}
                  setSelectedIssuecode={setSelectedIssuecode}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="sql" className="h-full m-0 p-0 border-none outline-none bg-surface overflow-auto">
              <div className="p-4 lg:px-12">
                <Suspense fallback={<TabFallback />}>
                  <SqlEditor query={sqlQuery} setQuery={setSqlQuery} />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="publications" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              <Suspense fallback={<TabFallback />}>
                {selectedIssuecode ? (
                  <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                    <IssueDetail
                      issuecode={selectedIssuecode}
                      onBack={() => navigateBack(() => setSelectedIssuecode(null))}
                      onSelectStory={(code) => {
                        setSelectedStorycode(code)
                        setActiveTab("stories")
                      }}
                    />
                  </div>
                ) : selectedPublicationcode ? (
                  <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                    <PublicationDetail
                      publicationcode={selectedPublicationcode}
                      onBack={() => navigateBack(() => setSelectedPublicationcode(null))}
                      onSelectIssue={(code) => setSelectedIssuecode(code)}
                    />
                  </div>
                ) : selectedPublisherid ? (
                  <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                    <PublisherDetail
                      publisherid={selectedPublisherid}
                      onBack={() => navigateBack(() => setSelectedPublisherid(null))}
                      onSelectPublication={(code) => setSelectedPublicationcode(code)}
                    />
                  </div>
                ) : (
                  <PublicationsSearch
                    selectedStorycode={selectedStorycode}
                    setSelectedStorycode={setSelectedStorycode}
                    selectedIssuecode={selectedIssuecode}
                    setSelectedIssuecode={setSelectedIssuecode}
                  />
                )}
              </Suspense>
            </TabsContent>

            <TabsContent value="countries" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              <Suspense fallback={<TabFallback />}>
                {selectedCountrycode ? (
                  <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                    <CountryPublications
                      countrycode={selectedCountrycode}
                      onBack={() => navigateBack(() => setSelectedCountrycode(null))}
                      onSelectPublication={(code) => {
                        setSelectedPublicationcode(code);
                        setActiveTab("publications"); // go back to publications to show details
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto w-full">
                    <CountryList onSelectCountry={setSelectedCountrycode} />
                  </div>
                )}
              </Suspense>
            </TabsContent>

            <TabsContent value="authors" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              <Suspense fallback={<TabFallback />}>
                <AuthorsSearch
                  selectedAuthorcode={selectedPersoncode}
                  setSelectedAuthorcode={setSelectedPersoncode}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="characters" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              <Suspense fallback={<TabFallback />}>
                <CharactersSearch
                  selectedCharactercode={selectedCharactercode}
                  setSelectedCharactercode={setSelectedCharactercode}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="settings" className="h-full m-0 p-0 border-none outline-none overflow-auto bg-surface-2/40">
              <Suspense fallback={<TabFallback />}>
                <Settings />
              </Suspense>
            </TabsContent>
          </div>
        </Tabs>
          {activeTab === "sql" && (
            <Suspense fallback={null}>
              <AiAssistant onCopyToEditor={(q) => setSqlQuery(q)} />
            </Suspense>
          )}
        </div>
        
        {/* Global Footer for legal mentions (temporairement caché)
        <footer className="px-4 py-4 shrink-0 border-t border-border-subtle bg-surface flex justify-center items-center text-xs text-text-hint">
          <LegalModal />
        </footer>
        */}
      </div>
      <Toaster position="top-center" richColors />
      <OnboardingModal />
    </TooltipProvider>
  )
}

export default App

