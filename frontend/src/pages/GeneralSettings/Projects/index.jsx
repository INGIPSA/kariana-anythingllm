import { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { FolderSimple } from "@phosphor-icons/react";
import { useModal } from "@/hooks/useModal";
import CTAButton from "@/components/lib/CTAButton";
import Project from "@/models/project";
import ProjectCard from "./ProjectCard";
import NewProjectModal from "./NewProjectModal";
import { isMobile } from "react-device-detect";

export default function Projects() {
  const { isOpen, openModal, closeModal } = useModal();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  const fetchProjects = async () => {
    const allProjects = await Project.getAll();
    setProjects(allProjects);
    return allProjects;
  };

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, []);

  const handleProjectCreated = () => {
    closeModal();
    fetchProjects();
  };

  const handleProjectDeleted = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex md:mt-0 mt-6">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
          <div className="w-full flex flex-col gap-y-1 pb-6 border-white/10 border-b-2">
            <div className="items-center flex gap-x-4">
              <p className="text-lg leading-6 font-bold text-theme-text-primary">
                Projects
              </p>
            </div>
            <p className="text-xs leading-[18px] font-base text-theme-text-secondary mt-2">
              Organize your work by project. Link DCC connections and workspaces
              to keep everything together.
            </p>
          </div>
          <div className="w-full justify-end flex">
            <CTAButton
              onClick={openModal}
              className="mt-3 mr-0 mb-4 md:-mb-14 z-10"
            >
              <FolderSimple className="h-4 w-4" weight="bold" /> New Project
            </CTAButton>
          </div>
          <div className="mt-6">
            {loading ? (
              <Skeleton.default
                height="80vh"
                width="100%"
                highlightColor="var(--theme-bg-primary)"
                baseColor="var(--theme-bg-secondary)"
                count={1}
                className="w-full p-4 rounded-b-2xl rounded-tr-2xl rounded-tl-sm"
                containerClassName="flex w-full"
              />
            ) : projects.length === 0 ? (
              <div className="w-full flex items-center justify-center min-h-[200px]">
                <p className="text-sm text-theme-text-secondary">
                  No projects yet. Create one to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDeleted={handleProjectDeleted}
                    onUpdated={fetchProjects}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <NewProjectModal
        isOpen={isOpen}
        onClose={closeModal}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}
